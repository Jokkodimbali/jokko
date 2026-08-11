const { chromium } = require('playwright');
const { io } = require('socket.io-client');

const apiBaseUrl = process.env.LIVE_TRACKING_API_URL ?? 'http://127.0.0.1:3000/api/v1';
const appBaseUrl = process.env.LIVE_TRACKING_APP_URL ?? 'http://127.0.0.1:4200';
const reservationId = process.env.LIVE_TRACKING_RESERVATION_ID;
const clientIdentifier = process.env.LIVE_TRACKING_CLIENT_IDENTIFIER;
const clientPassword = process.env.LIVE_TRACKING_CLIENT_PASSWORD;
const providerIdentifier = process.env.LIVE_TRACKING_PROVIDER_IDENTIFIER;
const providerPassword = process.env.LIVE_TRACKING_PROVIDER_PASSWORD;
const headless = process.env.LIVE_TRACKING_HEADLESS !== 'false';
const openViewers = process.env.LIVE_TRACKING_OPEN_VIEWERS !== 'false';

const missing = [
  ['LIVE_TRACKING_RESERVATION_ID', reservationId],
  ['LIVE_TRACKING_CLIENT_IDENTIFIER', clientIdentifier],
  ['LIVE_TRACKING_CLIENT_PASSWORD', clientPassword],
  ['LIVE_TRACKING_PROVIDER_IDENTIFIER', providerIdentifier],
  ['LIVE_TRACKING_PROVIDER_PASSWORD', providerPassword],
].filter(([, value]) => !value);

if (missing.length) {
  throw new Error(`Variables manquantes: ${missing.map(([name]) => name).join(', ')}`);
}

const pause = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function login(identifier, password) {
  const response = await fetch(`${apiBaseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ identifier, password }),
  });
  if (!response.ok) throw new Error(`Connexion API impossible (${response.status})`);
  return (await response.json()).data;
}

async function openViewer(browser, session, title) {
  console.log(`Ouverture de ${title}...`);
  const context = await browser.newContext({
    viewport: { width: 1440, height: 980 },
    recordVideo: { dir: 'test-results/manual-live-tracking' },
    permissions: ['geolocation'],
    geolocation: { latitude: 14.7244, longitude: -17.4725 },
  });
  const page = await context.newPage();
  await page.addInitScript((auth) => {
    localStorage.setItem('authStorageMode', 'local');
    localStorage.setItem('accessToken', auth.accessToken);
    localStorage.setItem('refreshToken', auth.refreshToken);
    localStorage.setItem('currentUser', JSON.stringify(auth.user));
  }, session);
  void page
    .goto(`${appBaseUrl}/appointments/${reservationId}`, { waitUntil: 'commit', timeout: 15_000 })
    .then(() => page.evaluate((value) => { document.title = value; }, title))
    .catch((error) => console.error(`${title}: ${error.message}`));
  console.log(`${title} ouvert.`);
  return { context, page };
}

async function getCurrentPosition(accessToken) {
  const response = await fetch(`${apiBaseUrl}/reservations/${reservationId}/live-tracking`, {
    headers: { authorization: `Bearer ${accessToken}` },
  });
  if (!response.ok) throw new Error(`Suivi indisponible (${response.status})`);
  return response.json();
}

async function connectPublisher(accessToken) {
  const socket = io(`${new URL(apiBaseUrl).origin}/socket`, {
    auth: { token: accessToken },
    transports: ['websocket'],
  });
  await new Promise((resolve, reject) => {
    socket.once('connect', resolve);
    socket.once('connect_error', reject);
  });
  return socket;
}

function publishPosition(socket, latitude, longitude, speedKmh, headingDegrees) {
  socket.emit('tracking.location.update', {
    reservationId,
    latitude,
    longitude,
    accuracyMeters: 6,
    headingDegrees,
    speedKmh,
    locationLabel: 'Simulation GPS prestataire',
    recordedAt: new Date().toISOString(),
  });
}

async function main() {
  console.log('Connexion des comptes de demonstration...');
  const [clientSession, providerSession] = await Promise.all([
    login(clientIdentifier, clientPassword),
    login(providerIdentifier, providerPassword),
  ]);
  console.log('Sessions pretes. Ouverture des deux navigateurs...');
  let browser = null;
  let clientViewer = null;
  let providerViewer = null;
  if (openViewers) {
    browser = await chromium.launch({ headless });
    [clientViewer, providerViewer] = await Promise.all([
      openViewer(browser, clientSession, 'Jokko - Client qui suit'),
      openViewer(browser, providerSession, 'Jokko - Prestataire qui se deplace'),
    ]);
    await Promise.all([
      clientViewer.page.locator('.appointment-detail__google-map').waitFor({ state: 'visible', timeout: 30_000 }),
      providerViewer.page.locator('.appointment-detail__google-map').waitFor({ state: 'visible', timeout: 30_000 }),
    ]);
  }

  console.log('Deux fenetres ouvertes. Marche lente puis vitesse vehicule en cours; Ctrl+C pour arreter.');
  const tracking = await getCurrentPosition(providerSession.accessToken);
  let latitude = tracking.data.lastLatitude;
  let longitude = tracking.data.lastLongitude;
  const publisher = await connectPublisher(providerSession.accessToken);
  const scenarios = [
    {
      label: 'Marche lente',
      speedKmh: 4.5,
      sampleCount: 24,
      intervalMs: 1_000,
      latitudeStep: 0.00001,
      longitudeStep: 0.000006,
    },
    {
      label: 'Vehicule rapide',
      speedKmh: 85,
      sampleCount: 36,
      intervalMs: 900,
      latitudeStep: 0.00017,
      longitudeStep: 0.00011,
    },
  ];

  try {
    for (const scenario of scenarios) {
      console.log(`${scenario.label} : ${scenario.sampleCount} positions a ${scenario.speedKmh} km/h.`);
      for (let index = 0; index < scenario.sampleCount; index += 1) {
        latitude += scenario.latitudeStep;
        longitude += scenario.longitudeStep;
        publishPosition(publisher, latitude, longitude, scenario.speedKmh, 33);
        if (index % 8 === 0) {
          console.log(`${scenario.label}: position ${index + 1}/${scenario.sampleCount} publiee`);
        }
        await pause(scenario.intervalMs);
      }
    }
    console.log('Simulation terminee : marche lente puis environ 750 m en vehicule.');
  } finally {
    publisher?.disconnect();
    if (headless && browser) await browser.close();
    void clientSession;
    void browser;
    void clientViewer;
    void providerViewer;
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
