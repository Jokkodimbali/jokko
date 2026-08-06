import {
  chromium,
  expect,
  test,
  type Browser,
  type BrowserContext,
  type CDPSession,
  type Page,
} from '@playwright/test';
import { execFileSync } from 'node:child_process';

const credentials = {
  client: {
    identifier: process.env['JOKKO_CALL_CLIENT_IDENTIFIER'],
    password: process.env['JOKKO_CALL_CLIENT_PASSWORD'],
  },
  provider: {
    identifier: process.env['JOKKO_CALL_PROVIDER_IDENTIFIER'],
    password: process.env['JOKKO_CALL_PROVIDER_PASSWORD'],
  },
};
const conversationId = process.env['JOKKO_CALL_CONVERSATION_ID'];
const osNetworkTestEnabled = process.env['JOKKO_OS_NETWORK_TEST'] === '1';
const chromeExecutable = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const firewallRuleName = 'Jokko QA Chrome Network Cut';
const configured = Boolean(
  credentials.client.identifier &&
  credentials.client.password &&
  credentials.provider.identifier &&
  credentials.provider.password &&
  conversationId,
);

test.use({
  launchOptions: {
    args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'],
  },
});

test.describe.serial('LiveKit network and browser resilience', () => {
  test.skip(!configured, 'Dedicated call-test credentials are required.');

  test('recovers from 10, 30 and 60 second network interruptions', async ({ browser }) => {
    test.skip(!osNetworkTestEnabled, 'Requires an elevated Windows firewall test run.');
    test.setTimeout(300_000);
    setChromeNetworkBlocked(false);
    const chrome = await chromium.launch({
      channel: 'chrome',
      args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'],
    });
    const clientContext = await createContext(chrome, ['microphone', 'camera']);
    const providerContext = await createContext(browser, ['microphone', 'camera']);
    const client = await clientContext.newPage();
    const provider = await providerContext.newPage();
    try {
      await prepareUsers(client, provider);
      await startVideoCall(client, provider);
      for (const duration of [10_000, 30_000, 60_000]) {
        setChromeNetworkBlocked(true);
        await expect(client.getByText(/Reconnexion en cours/i)).toBeVisible({
          timeout: 20_000,
        });
        await client.waitForTimeout(duration);
        setChromeNetworkBlocked(false);
        await expect(client.getByText(/Reconnexion en cours/i)).toBeHidden({
          timeout: 60_000,
        });
        await expect(client.locator('.call-overlay video')).toHaveCount(2, {
          timeout: 60_000,
        });
        await expect(provider.locator('.call-overlay video')).toHaveCount(2, {
          timeout: 60_000,
        });
      }
    } finally {
      setChromeNetworkBlocked(false);
      await safelyHangUp(client);
      await safelyHangUp(provider);
      await Promise.all([clientContext.close(), providerContext.close()]);
      await chrome.close();
    }
  });

  test('survives simulated WiFi/4G handoffs and reports WebRTC quality', async ({ browser }) => {
    test.setTimeout(180_000);
    const pair = await createPair(browser);
    let cdp: CDPSession | null = null;
    try {
      await startVideoCall(pair.client, pair.provider);
      cdp = await pair.clientContext.newCDPSession(pair.client);
      await cdp.send('Network.enable');
      const profiles = [
        { name: 'wifi', latency: 20, download: 20_000_000, upload: 8_000_000 },
        { name: '4g', latency: 80, download: 4_000_000, upload: 1_500_000 },
        { name: 'wifi-return', latency: 20, download: 20_000_000, upload: 8_000_000 },
        { name: 'fast-3g', latency: 150, download: 1_600_000, upload: 750_000 },
        { name: 'slow-3g', latency: 400, download: 500_000, upload: 250_000 },
      ];
      const measurements: Record<string, MediaStats> = {};
      for (const profile of profiles) {
        await cdp.send('Network.emulateNetworkConditions', {
          offline: false,
          latency: profile.latency,
          downloadThroughput: profile.download / 8,
          uploadThroughput: profile.upload / 8,
          connectionType: profile.name.startsWith('wifi') ? 'wifi' : 'cellular4g',
        });
        await pair.client.waitForTimeout(12_000);
        await expect(pair.client.locator('.call-overlay')).toBeVisible();
        measurements[profile.name] = await mediaStats(pair.client);
      }
      console.log(`WEBRTC_QUALITY ${JSON.stringify(measurements)}`);
      for (const profile of profiles) {
        expect(measurements[profile.name].peerConnections, profile.name).toBeGreaterThan(0);
        expect(measurements[profile.name].inboundReports, profile.name).toBeGreaterThan(0);
      }
    } finally {
      if (cdp) {
        await cdp
          .send('Network.emulateNetworkConditions', {
            offline: false,
            latency: 0,
            downloadThroughput: -1,
            uploadThroughput: -1,
          })
          .catch(() => undefined);
      }
      await endAndClosePair(pair);
    }
  });

  for (const permissionCase of [
    { name: 'camera denied', permissions: ['microphone'] },
    { name: 'microphone denied', permissions: ['camera'] },
    { name: 'camera and microphone denied', permissions: [] },
  ]) {
    test(`handles ${permissionCase.name} without crashing`, async ({ browser }) => {
      test.setTimeout(90_000);
      const deniedKinds = permissionCase.name.includes('camera and microphone')
        ? ['camera', 'microphone']
        : [permissionCase.name.startsWith('camera') ? 'camera' : 'microphone'];
      const clientContext = await createContext(
        browser,
        ['microphone', 'camera'],
        deniedKinds as Array<'camera' | 'microphone'>,
      );
      const providerContext = await createContext(browser, ['microphone', 'camera']);
      const client = await clientContext.newPage();
      const provider = await providerContext.newPage();
      const pageErrors: string[] = [];
      client.on('pageerror', (error) => pageErrors.push(error.message));
      try {
        await prepareUsers(client, provider);
        await client.getByRole('button', { name: 'Appel vidéo' }).click();
        await expect(provider.locator('.call-overlay')).toBeVisible({ timeout: 15_000 });
        await provider.getByRole('button', { name: /Accepter/i }).click();
        await expect(client.locator('.app-feedback')).toContainText(
          /L'appel continue sans|Autorisez|microphone|caméra/i,
          {
            timeout: 30_000,
          },
        );
        await expect(client.locator('.call-overlay')).toBeVisible();
        await expect(provider.locator('.call-overlay')).toBeVisible();
        await expect(client.locator('.call-overlay__duration')).toBeVisible();
        await expect(provider.locator('.call-overlay__duration')).toBeVisible();
        expect(pageErrors).toEqual([]);
      } finally {
        await safelyHangUp(client);
        await safelyHangUp(provider);
        await Promise.all([clientContext.close(), providerContext.close()]);
      }
    });
  }

  test('handles permissions removed during an active call', async ({ browser }) => {
    test.setTimeout(120_000);
    const pair = await createPair(browser);
    const pageErrors: string[] = [];
    pair.client.on('pageerror', (error) => pageErrors.push(error.message));
    try {
      await startVideoCall(pair.client, pair.provider);
      await pair.clientContext.clearPermissions();
      const stoppedKinds = await pair.client.evaluate(() => {
        const peers = (window as typeof window & { __jokkoPeers?: Set<RTCPeerConnection> })
          .__jokkoPeers;
        const kinds = new Set<string>();
        for (const peer of peers ?? []) {
          for (const sender of peer.getSenders()) {
            if (!sender.track) continue;
            kinds.add(sender.track.kind);
            sender.track.stop();
            sender.track.dispatchEvent(new Event('ended'));
          }
        }
        return [...kinds].sort();
      });
      expect(stoppedKinds).toEqual(['audio', 'video']);
      await expect(pair.provider.getByText(/Caméra pas activée/i)).toBeVisible({ timeout: 20_000 });
      expect(pageErrors).toEqual([]);
      await expect(pair.client.locator('.call-overlay')).toBeVisible();
    } finally {
      await endAndClosePair(pair);
    }
  });

  test('allows only one acceptance across two Chrome tabs and Edge', async ({ browser }) => {
    test.setTimeout(180_000);
    const chrome = await chromium.launch({
      channel: 'chrome',
      args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'],
    });
    const chromeContext = await createContext(chrome, ['microphone', 'camera']);
    const edgeClientContext = await createContext(browser, ['microphone', 'camera']);
    const providerContext = await createContext(browser, ['microphone', 'camera']);
    const chromeTab1 = await chromeContext.newPage();
    const chromeTab2 = await chromeContext.newPage();
    const edgeTab = await edgeClientContext.newPage();
    const provider = await providerContext.newPage();
    try {
      await Promise.all([
        login(chromeTab1, credentials.client),
        login(chromeTab2, credentials.client),
        login(edgeTab, credentials.client),
        login(provider, credentials.provider),
      ]);
      await Promise.all([
        openConversation(chromeTab1),
        openConversation(chromeTab2),
        openConversation(edgeTab),
        openConversation(provider),
      ]);
      await provider.getByRole('button', { name: 'Appel vidéo' }).click();
      for (const page of [chromeTab1, chromeTab2, edgeTab]) {
        await expect(page.getByRole('button', { name: /Accepter/i })).toBeVisible({
          timeout: 20_000,
        });
      }
      await chromeTab1.getByRole('button', { name: /Accepter/i }).click();
      await expect(chromeTab1.locator('.call-overlay__duration')).toBeVisible({ timeout: 30_000 });
      await expect(provider.locator('.call-overlay__duration')).toBeVisible({ timeout: 30_000 });
      await expect(chromeTab2.locator('.call-overlay')).toBeHidden({ timeout: 15_000 });
      await expect(edgeTab.locator('.call-overlay')).toBeHidden({ timeout: 15_000 });
      expect((await resourceCounts(chromeTab2)).peerConnections).toBe(0);
      expect((await resourceCounts(edgeTab)).peerConnections).toBe(0);
      await chromeTab2.close();
      await edgeClientContext.close();
      await chromeTab1.waitForTimeout(75_000);
      await expect(chromeTab1.locator('.call-overlay__duration')).toBeVisible();
      await expect(provider.locator('.call-overlay__duration')).toBeVisible();
    } finally {
      for (const page of [chromeTab1, chromeTab2, edgeTab, provider]) await safelyHangUp(page);
      await Promise.all([
        chromeContext.close(),
        edgeClientContext.close(),
        providerContext.close(),
      ]);
      await chrome.close();
    }
  });

  test('marks a call terminal after both browsers close abruptly', async ({ browser, request }) => {
    test.setTimeout(210_000);
    const crashedChrome = await chromium.launch({
      channel: 'chrome',
      args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'],
    });
    const clientContext = await createContext(crashedChrome, ['microphone', 'camera']);
    const providerContext = await createContext(browser, ['microphone', 'camera']);
    const client = await clientContext.newPage();
    const provider = await providerContext.newPage();
    await prepareUsers(client, provider);
    await startVideoCall(client, provider, false);
    const browserSession = await crashedChrome.newBrowserCDPSession();
    await browserSession.send('Browser.crash').catch(() => undefined);
    await providerContext.close();
    await crashedChrome.close().catch(() => undefined);
    await new Promise((resolve) => setTimeout(resolve, 80_000));

    const loginResponse = await request.post('http://127.0.0.1:3000/api/v1/auth/login', {
      data: credentials.client,
    });
    expect(loginResponse.ok()).toBe(true);
    const token = ((await loginResponse.json()) as { data: { accessToken: string } }).data
      .accessToken;
    const activeResponse = await request.get('http://127.0.0.1:3000/api/v1/calls/active', {
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(activeResponse.ok()).toBe(true);
    const active = ((await activeResponse.json()) as { data: unknown }).data;
    expect(
      active,
      'The call must not remain active after both browser processes disappear',
    ).toBeNull();
  });
});

type Credentials = { identifier?: string; password?: string };
type CallPair = {
  clientContext: BrowserContext;
  providerContext: BrowserContext;
  client: Page;
  provider: Page;
};
type MediaStats = {
  peerConnections: number;
  inboundReports: number;
  outboundReports: number;
  rttMs: number | null;
  jitterMs: number | null;
  packetsLost: number;
  bytesReceived: number;
  bytesSent: number;
};

async function createContext(
  browser: Browser,
  permissions: string[],
  deniedKinds: Array<'camera' | 'microphone'> = [],
): Promise<BrowserContext> {
  const context = await browser.newContext({ permissions });
  await context.addInitScript((denied) => {
    const peers = new Set<RTCPeerConnection>();
    const OriginalPeerConnection = window.RTCPeerConnection;
    const InstrumentedPeerConnection = function (
      this: RTCPeerConnection,
      ...args: ConstructorParameters<typeof RTCPeerConnection>
    ) {
      const peer = new OriginalPeerConnection(...args);
      peers.add(peer);
      peer.addEventListener('connectionstatechange', () => {
        if (peer.connectionState === 'closed') peers.delete(peer);
      });
      return peer;
    } as unknown as typeof RTCPeerConnection;
    InstrumentedPeerConnection.prototype = OriginalPeerConnection.prototype;
    window.RTCPeerConnection = InstrumentedPeerConnection;
    if (denied.length > 0) {
      const originalGetUserMedia = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
      navigator.mediaDevices.getUserMedia = async (constraints) => {
        const cameraDenied = denied.includes('camera') && Boolean(constraints.video);
        const microphoneDenied = denied.includes('microphone') && Boolean(constraints.audio);
        if (cameraDenied || microphoneDenied) {
          throw new DOMException('Permission denied by resilience test', 'NotAllowedError');
        }
        return originalGetUserMedia(constraints);
      };
    }
    Object.assign(window, { __jokkoPeers: peers });
  }, deniedKinds);
  return context;
}

async function createPair(browser: Browser): Promise<CallPair> {
  const clientContext = await createContext(browser, ['microphone', 'camera']);
  const providerContext = await createContext(browser, ['microphone', 'camera']);
  const client = await clientContext.newPage();
  const provider = await providerContext.newPage();
  await prepareUsers(client, provider);
  return { clientContext, providerContext, client, provider };
}

async function prepareUsers(client: Page, provider: Page): Promise<void> {
  await Promise.all([login(client, credentials.client), login(provider, credentials.provider)]);
  await Promise.all([openConversation(client), openConversation(provider)]);
}

async function login(page: Page, account: Credentials): Promise<void> {
  await page.goto('/auth/login', { waitUntil: 'domcontentloaded' });
  await page.locator('#loginIdentifier').fill(account.identifier!);
  await page.locator('#password').fill(account.password!);
  const response = page.waitForResponse((item) => item.url().includes('/api/v1/auth/login'));
  await page.getByRole('button', { name: 'Se connecter' }).click();
  expect((await response).ok()).toBe(true);
  await page.waitForURL('**/services');
}

async function openConversation(page: Page): Promise<void> {
  await page.goto(`/messages?conversationId=${conversationId}`, { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('button', { name: 'Appel vidéo' })).toBeVisible();
}

async function startVideoCall(caller: Page, recipient: Page, prepare = true): Promise<void> {
  if (prepare) {
    // The pair is already authenticated and positioned by createPair.
  }
  await caller.getByRole('button', { name: 'Appel vidéo' }).click();
  await expect(recipient.getByRole('button', { name: /Accepter/i })).toBeVisible({
    timeout: 20_000,
  });
  await recipient.getByRole('button', { name: /Accepter/i }).click();
  await expect(caller.locator('.call-overlay__duration')).toBeVisible({ timeout: 30_000 });
  await expect(recipient.locator('.call-overlay__duration')).toBeVisible({ timeout: 30_000 });
  await expect(caller.locator('.call-overlay video')).toHaveCount(2, { timeout: 30_000 });
  await expect(recipient.locator('.call-overlay video')).toHaveCount(2, { timeout: 30_000 });
}

async function safelyHangUp(page: Page): Promise<void> {
  const button = page.getByRole('button', { name: /Raccrocher/i });
  if (await button.isVisible().catch(() => false)) await button.click().catch(() => undefined);
}

async function endAndClosePair(pair: CallPair): Promise<void> {
  await safelyHangUp(pair.client);
  await safelyHangUp(pair.provider);
  await Promise.all([pair.clientContext.close(), pair.providerContext.close()]);
}

async function resourceCounts(page: Page): Promise<{ peerConnections: number }> {
  return page.evaluate(() => {
    const peers = (window as typeof window & { __jokkoPeers?: Set<RTCPeerConnection> })
      .__jokkoPeers;
    return {
      peerConnections: peers
        ? [...peers].filter((peer) => peer.connectionState !== 'closed').length
        : 0,
    };
  });
}

async function mediaStats(page: Page): Promise<MediaStats> {
  return page.evaluate(async () => {
    const peers = (window as typeof window & { __jokkoPeers?: Set<RTCPeerConnection> })
      .__jokkoPeers;
    const result: MediaStats = {
      peerConnections: 0,
      inboundReports: 0,
      outboundReports: 0,
      rttMs: null,
      jitterMs: null,
      packetsLost: 0,
      bytesReceived: 0,
      bytesSent: 0,
    };
    for (const peer of peers ?? []) {
      if (peer.connectionState === 'closed') continue;
      result.peerConnections += 1;
      const stats = await peer.getStats();
      stats.forEach((report) => {
        if (
          report.type === 'candidate-pair' &&
          report.state === 'succeeded' &&
          report.currentRoundTripTime
        ) {
          result.rttMs = Math.round(report.currentRoundTripTime * 1_000);
        }
        if (report.type === 'inbound-rtp' && !report.isRemote) {
          result.inboundReports += 1;
          result.packetsLost += report.packetsLost ?? 0;
          result.bytesReceived += report.bytesReceived ?? 0;
          if (typeof report.jitter === 'number')
            result.jitterMs = Math.round(report.jitter * 1_000);
        }
        if (report.type === 'outbound-rtp' && !report.isRemote) {
          result.outboundReports += 1;
          result.bytesSent += report.bytesSent ?? 0;
        }
      });
    }
    return result;
  });
}

function setChromeNetworkBlocked(blocked: boolean): void {
  execFileSync(
    'netsh.exe',
    ['advfirewall', 'firewall', 'delete', 'rule', `name=${firewallRuleName}`],
    { stdio: 'ignore' },
  );
  if (!blocked) return;
  execFileSync(
    'netsh.exe',
    [
      'advfirewall',
      'firewall',
      'add',
      'rule',
      `name=${firewallRuleName}`,
      'dir=out',
      'action=block',
      `program=${chromeExecutable}`,
      'enable=yes',
      'profile=any',
    ],
    { stdio: 'ignore' },
  );
}
