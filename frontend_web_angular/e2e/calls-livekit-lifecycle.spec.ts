import { expect, test, type Browser, type BrowserContext, type Page } from '@playwright/test';

const clientIdentifier = process.env['JOKKO_CALL_CLIENT_IDENTIFIER'];
const clientPassword = process.env['JOKKO_CALL_CLIENT_PASSWORD'];
const providerIdentifier = process.env['JOKKO_CALL_PROVIDER_IDENTIFIER'];
const providerPassword = process.env['JOKKO_CALL_PROVIDER_PASSWORD'];
const conversationId = process.env['JOKKO_CALL_CONVERSATION_ID'];
const cycles = Number(process.env['JOKKO_CALL_CYCLES'] ?? '1');
const callKind = process.env['JOKKO_CALL_KIND'] === 'VIDEO' ? 'VIDEO' : 'VOICE';
const callButtonName = callKind === 'VIDEO' ? 'Appel vidéo' : 'Appel vocal';

test.use({
  launchOptions: {
    args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'],
  },
});

test.describe('LiveKit call lifecycle', () => {
  test.skip(
    !clientIdentifier ||
      !clientPassword ||
      !providerIdentifier ||
      !providerPassword ||
      !conversationId,
    'Dedicated call-test credentials are required.',
  );

  test(`releases browser media resources after ${cycles} ${callKind} call cycle(s)`, async ({
    browser,
  }) => {
    test.setTimeout(Math.max(120_000, cycles * 30_000));
    const clientContext = await createCallContext(browser);
    const providerContext = await createCallContext(browser);
    const client = await clientContext.newPage();
    const provider = await providerContext.newPage();
    const diagnostics: string[] = [];
    collectDiagnostics(client, 'client', diagnostics);
    collectDiagnostics(provider, 'provider', diagnostics);

    try {
      await Promise.all([
        login(client, clientIdentifier!, clientPassword!),
        login(provider, providerIdentifier!, providerPassword!),
      ]);
      await Promise.all([
        openConversation(client, conversationId!),
        openConversation(provider, conversationId!),
      ]);
      const clientSocketBaseline = (await mediaResources(client)).activeWebSockets;
      const providerSocketBaseline = (await mediaResources(provider)).activeWebSockets;

      for (let index = 0; index < cycles; index += 1) {
        await client.getByRole('button', { name: callButtonName }).click();
        await client
          .locator('.call-overlay')
          .waitFor({ state: 'visible', timeout: 15_000 })
          .catch(() => undefined);
        await provider
          .locator('.call-overlay')
          .waitFor({ state: 'visible', timeout: 15_000 })
          .catch(() => undefined);
        const clientOverlay = await client.locator('.call-overlay').count();
        const providerOverlay = await provider.locator('.call-overlay').count();
        if (clientOverlay === 0 || providerOverlay === 0) {
          const feedback = await client.locator('.app-feedback').allTextContents();
          const callButtonDisabled = await client
            .getByRole('button', { name: 'Appel vocal' })
            .isDisabled();
          throw new Error(
            JSON.stringify(
              { clientOverlay, providerOverlay, feedback, callButtonDisabled, diagnostics },
              null,
              2,
            ),
          );
        }
        await expect(provider.locator('.call-overlay')).toBeVisible();
        await provider.getByRole('button', { name: /Accepter/i }).click();
        await expect(client.locator('.call-overlay__duration')).toBeVisible({ timeout: 20_000 });
        await expect(provider.locator('.call-overlay__duration')).toBeVisible({ timeout: 20_000 });
        if (callKind === 'VIDEO') {
          try {
            await expect(client.locator('.call-overlay video')).toHaveCount(2, { timeout: 20_000 });
            await expect(provider.locator('.call-overlay video')).toHaveCount(2, {
              timeout: 20_000,
            });
          } catch (error) {
            throw new Error(
              JSON.stringify(
                {
                  cause: error instanceof Error ? error.message : String(error),
                  clientResources: await mediaResources(client),
                  providerResources: await mediaResources(provider),
                  clientStage: await client.locator('.call-overlay__stage').innerHTML(),
                  providerStage: await provider.locator('.call-overlay__stage').innerHTML(),
                  diagnostics,
                },
                null,
                2,
              ),
            );
          }
        }

        await client.getByRole('button', { name: /Raccrocher/i }).click();
        await expect(client.locator('.call-overlay')).toBeHidden({ timeout: 15_000 });
        await expect(provider.locator('.call-overlay')).toBeHidden({ timeout: 15_000 });
        await client.waitForTimeout(750);

        expect(await mediaResources(client), `client cycle ${index + 1}`).toEqual({
          peerConnections: 0,
          liveTracks: 0,
          mediaElements: 0,
          activeWebSockets: clientSocketBaseline,
          liveKitWebSockets: 0,
        });
        expect(await mediaResources(provider), `provider cycle ${index + 1}`).toEqual({
          peerConnections: 0,
          liveTracks: 0,
          mediaElements: 0,
          activeWebSockets: providerSocketBaseline,
          liveKitWebSockets: 0,
        });
      }
    } finally {
      for (const page of [client, provider]) {
        const hangup = page.getByRole('button', { name: /Raccrocher/i });
        if (await hangup.isVisible().catch(() => false))
          await hangup.click().catch(() => undefined);
      }
      await Promise.all([clientContext.close(), providerContext.close()]);
    }
  });
});

async function createCallContext(browser: Browser) {
  const context = (await browser.newContext({
    permissions: ['microphone', 'camera'],
  })) as BrowserContext;
  await context.addInitScript(() => {
    const peerConnections = new Set<RTCPeerConnection>();
    const tracks = new Set<MediaStreamTrack>();
    const activeWebSockets = new Set<string>();
    const OriginalWebSocket = window.WebSocket;
    const InstrumentedWebSocket = function (
      this: WebSocket,
      ...args: ConstructorParameters<typeof WebSocket>
    ) {
      const socket = new OriginalWebSocket(...args);
      activeWebSockets.add(socket.url);
      socket.addEventListener('close', () => activeWebSockets.delete(socket.url), { once: true });
      return socket;
    } as unknown as typeof WebSocket;
    InstrumentedWebSocket.prototype = OriginalWebSocket.prototype;
    window.WebSocket = InstrumentedWebSocket;
    const OriginalPeerConnection = window.RTCPeerConnection;
    const InstrumentedPeerConnection = function (
      this: RTCPeerConnection,
      ...args: ConstructorParameters<typeof RTCPeerConnection>
    ) {
      const peer = new OriginalPeerConnection(...args);
      peerConnections.add(peer);
      peer.addEventListener('connectionstatechange', () => {
        if (peer.connectionState === 'closed') peerConnections.delete(peer);
      });
      return peer;
    } as unknown as typeof RTCPeerConnection;
    InstrumentedPeerConnection.prototype = OriginalPeerConnection.prototype;
    window.RTCPeerConnection = InstrumentedPeerConnection;

    const originalGetUserMedia = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
    navigator.mediaDevices.getUserMedia = async (constraints) => {
      const stream = await originalGetUserMedia(constraints);
      for (const track of stream.getTracks()) {
        tracks.add(track);
        track.addEventListener('ended', () => tracks.delete(track), { once: true });
      }
      return stream;
    };
    Object.assign(window, { __jokkoCallResources: { peerConnections, tracks, activeWebSockets } });
  });
  return context;
}

function collectDiagnostics(page: Page, label: string, output: string[]): void {
  page.on('console', (message) => {
    if (message.type() === 'error') output.push(`${label} console: ${message.text()}`);
  });
  page.on('response', (response) => {
    if (response.status() >= 400) {
      output.push(`${label} HTTP ${response.status()}: ${new URL(response.url()).pathname}`);
    }
  });
  page.on('pageerror', (error) => output.push(`${label} page: ${error.message}`));
  page.on('websocket', (socket) => {
    output.push(`${label} websocket: ${new URL(socket.url()).pathname}`);
    socket.on('framesent', ({ payload }) => {
      if (typeof payload === 'string' && payload.includes('call.')) {
        output.push(`${label} sent: ${payload.slice(0, 180)}`);
      }
    });
    socket.on('framereceived', ({ payload }) => {
      if (typeof payload === 'string' && payload.includes('call.')) {
        output.push(`${label} received: ${payload.slice(0, 2_000)}`);
      }
    });
  });
}

async function login(page: Page, identifier: string, password: string): Promise<void> {
  await page.goto('/auth/login', { waitUntil: 'domcontentloaded' });
  await page.locator('#loginIdentifier').fill(identifier);
  await page.locator('#password').fill(password);
  const response = page.waitForResponse((item) => item.url().includes('/api/v1/auth/login'));
  await page.getByRole('button', { name: 'Se connecter' }).click();
  expect((await response).ok()).toBe(true);
  await page.waitForURL('**/services');
}

async function openConversation(page: Page, id: string): Promise<void> {
  await page.goto(`/messages?conversationId=${id}`, { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('button', { name: callButtonName })).toBeVisible();
}

async function mediaResources(page: Page) {
  return page.evaluate(() => {
    const resources = (
      window as typeof window & {
        __jokkoCallResources?: {
          peerConnections: Set<RTCPeerConnection>;
          tracks: Set<MediaStreamTrack>;
          activeWebSockets: Set<string>;
        };
      }
    ).__jokkoCallResources;
    return {
      peerConnections: resources
        ? [...resources.peerConnections].filter((peer) => peer.connectionState !== 'closed').length
        : 0,
      liveTracks: resources
        ? [...resources.tracks].filter((track) => track.readyState === 'live').length
        : 0,
      mediaElements: document.querySelectorAll('.call-overlay audio, .call-overlay video').length,
      activeWebSockets: resources?.activeWebSockets.size ?? 0,
      liveKitWebSockets: resources
        ? [...resources.activeWebSockets].filter((url) => url.includes('livekit.cloud')).length
        : 0,
    };
  });
}
