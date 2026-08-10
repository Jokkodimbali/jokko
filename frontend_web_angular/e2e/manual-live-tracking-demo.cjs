const { chromium } = require('playwright');

const apiBaseUrl = process.env.LIVE_TRACKING_API_URL ?? 'http://127.0.0.1:3000/api/v1';
const appBaseUrl = process.env.LIVE_TRACKING_APP_URL ?? 'http://127.0.0.1:4200';
const reservationId = process.env.LIVE_TRACKING_RESERVATION_ID;
const clientIdentifier = process.env.LIVE_TRACKING_CLIENT_IDENTIFIER;
const clientPassword = process.env.LIVE_TRACKING_CLIENT_PASSWORD;
const providerIdentifier = process.env.LIVE_TRACKING_PROVIDER_IDENTIFIER;
const providerPassword = process.env.LIVE_TRACKING_PROVIDER_PASSWORD;

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
  return (await response.json()).data.accessToken;
}

async function openViewer(identifier, password, title) {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 980 },
    permissions: ['geolocation'],
    geolocation: { latitude: 14.7244, longitude: -17.4725 },
  });
  const page = await context.newPage();
  await page.goto(`${appBaseUrl}/auth/login`, { waitUntil: 'domcontentloaded' });
  await page.getByLabel(/Telephone ou email/i).fill(identifier);
  await page.getByLabel(/^Mot de passe/i).fill(password);
  await page.getByRole('button', { name: /^Se connecter$/i }).click();
  await pause(800);
  await page.goto(`${appBaseUrl}/appointments/${reservationId}`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1_500);
  await page.evaluate((value) => {
    document.title = value;
  }, title);
  return browser;
}

async function publishPosition(accessToken, latitude, longitude, speedKmh, headingDegrees) {
  const response = await fetch(
    `${apiBaseUrl}/reservations/${reservationId}/live-tracking/location`,
    {
      method: 'PATCH',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        latitude,
        longitude,
        accuracyMeters: 6,
        headingDegrees,
        speedKmh,
        locationLabel: 'Simulation longue vitesse vehicule',
        recordedAt: new Date().toISOString(),
      }),
    },
  );
  if (!response.ok) throw new Error(`Position refusee (${response.status})`);
}

async function main() {
  const [clientToken, providerToken] = await Promise.all([
    login(clientIdentifier, clientPassword),
    login(providerIdentifier, providerPassword),
  ]);
  const [clientBrowser, providerBrowser] = await Promise.all([
    openViewer(clientIdentifier, clientPassword, 'Jokko - Client qui se deplace'),
    openViewer(providerIdentifier, providerPassword, 'Jokko - Prestataire qui suit'),
  ]);

  console.log('Deux fenetres ouvertes. Simulation longue en cours; Ctrl+C pour arreter.');
  let latitude = 14.7262;
  let longitude = -17.4713;
  const speedKmh = 85;
  const sampleCount = 120;

  try {
    for (let index = 0; index < sampleCount; index += 1) {
      // Environ 21 m toutes les 0,9 s: une vitesse routiere de 85 km/h.
      latitude += 0.00017;
      longitude += 0.00011;
      await publishPosition(clientToken, latitude, longitude, speedKmh, 33);
      if (index % 10 === 0) {
        console.log(`Position ${index + 1}/${sampleCount} publiee`);
      }
      await pause(900);
    }
    console.log('Simulation terminee: 120 positions, environ 2,5 km.');
  } finally {
    // Les fenetres restent ouvertes pour inspection. Fermez-les manuellement.
    void providerToken;
    void clientBrowser;
    void providerBrowser;
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
