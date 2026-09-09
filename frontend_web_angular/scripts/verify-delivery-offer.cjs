// Built app with mocked offers: never sends requests to a real API.
const { chromium, expect } = require('@playwright/test');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
(async () => {
  const root = path.resolve(__dirname, '../dist/frontend_web_angular/browser');
  const artifacts = path.resolve(__dirname, '../test-results/delivery-offer');
  fs.mkdirSync(artifacts, { recursive: true });
  const server = http.createServer((req, res) => {
    let file = path.join(root, decodeURIComponent(new URL(req.url, 'http://localhost').pathname));
    if (!file.startsWith(root)) {
      res.writeHead(403);
      res.end();
      return;
    }
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory())
      file = path.join(root, 'index.html');
    const mime = {
      '.js': 'application/javascript',
      '.css': 'text/css',
      '.html': 'text/html',
      '.png': 'image/png',
      '.woff2': 'font/woff2',
    };
    res.setHeader('Content-Type', mime[path.extname(file)] || 'application/octet-stream');
    fs.createReadStream(file).pipe(res);
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const base = 'http://127.0.0.1:' + server.address().port;
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    for (const width of [1440, 1024, 768, 390, 320]) {
      const context = await browser.newContext({ viewport: { width, height: 900 } });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', (error) => errors.push(error.message));
      let available = true;
      const offer = {
        id: 'notification-test',
        orderId: 'order-test',
        kind: 'PHARMACY',
        storeName: 'Pharmacie du Plateau',
        avatarUrl: base + '/logojokko.png',
        address: 'Dakar Plateau',
        latitude: 14.67,
        longitude: -17.43,
        distanceKm: 0.78,
        createdAt: new Date().toISOString(),
      };
      await context.addInitScript(() => {
        window.google = {
          maps: {
            Map: class {
              constructor(element) {
                this.element = element;
                element.dataset.mapReady = 'true';
                element.style.background = '#e4ebe0';
              }
              setCenter() {}
            },
            marker: {
              AdvancedMarkerElement: class {
                constructor(options) {
                  Object.assign(this, options); options.map.element.appendChild(options.content);
                }
              },
            },
            event: { clearInstanceListeners() {} },
          },
        };
        const token =
          btoa(JSON.stringify({ alg: 'none' })) +
          '.' +
          btoa(
            JSON.stringify({
              sub: 'courier-test',
              role: 'PRESTATAIRE',
              exp: Math.floor(Date.now() / 1000) + 3600,
            }),
          ) +
          '.test';
        localStorage.setItem('accessToken', token);
        localStorage.setItem(
          'currentUser',
          JSON.stringify({ id: 'courier-test', name: 'Livreur test', role: 'PRESTATAIRE' }),
        );
      });
      await context.route('http://localhost:3000/**', async (route) => {
        const url = route.request().url();
        let data = [];
        if (url.includes('/users/me'))
          data = { id: 'courier-test', nom: 'Livreur test', role: 'PRESTATAIRE' };
        if (url.endsWith('/notifications/delivery-offers')) data = available ? [offer] : [];
        if (url.includes('/delivery-offer/decline')) {
          available = false;
          data = null;
        }
        await route.fulfill({ json: { success: true, data } });
      });
      await page.goto(base + '/notifications');
      const card = page.locator('.delivery-card');
      await expect(card).toBeVisible();
      await expect(card.getByText('Pharmacie du Plateau')).toBeVisible();
      await expect(card.getByText('780 m · 2 min')).toBeVisible();
      await expect(card.locator('.delivery-card__avatar img')).toBeVisible();
      await expect(card.locator('.merchant-marker img')).toBeVisible();
      await expect(card.locator('[data-map-ready]')).toBeVisible();
      await card.evaluate((element) =>
        Promise.all(
          element.getAnimations().map((animation) => animation.finished.catch(() => undefined)),
        ),
      );
      const bellBox = await page.locator('[appNotificationAnchor]').evaluateAll(elements => {
        const element = elements.find(el => el.getBoundingClientRect().width > 0);
        const rect = element.getBoundingClientRect();
        if (getComputedStyle(element).visibility !== 'hidden') throw new Error('Bell should be replaced during offer');
        return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
      });
      const box = await card.boundingBox();
      if (Math.abs(box.y - bellBox.y) > 2)
        throw new Error('Card does not replace the bell at its anchor');
      if (width >= 1024) {
        const navBox = await page.locator('.app-navbar__nav').boundingBox();
        const profile = page.locator('.app-navbar__profile');
        const profileBox = await profile.boundingBox();
        await expect(profile).toContainText('Livreur test');
        if (navBox.x + navBox.width > bellBox.x + 1 || bellBox.x + bellBox.width > profileBox.x + 1)
          throw new Error('Navbar elements overlap: ' + JSON.stringify({ navBox, bellBox, profileBox }));
      }
      if (box.x < 0 || box.x + box.width > width + 1) throw new Error('Card overflows viewport');
      await card.evaluate((element) =>
        Promise.all(
          element.getAnimations().map((animation) => animation.finished.catch(() => undefined)),
        ),
      );

      await page.screenshot({ path: path.join(artifacts, 'card-' + width + '.png') });
      await card.getByRole('button', { name: 'Refuser', exact: true }).click();
      await expect(card).toBeHidden();
      await expect(page.locator('[appNotificationAnchor]:visible')).toBeVisible();
      await context.close();
      if (errors.length) throw new Error(errors.join('; '));
      console.log(
        'Verified ' +
          width +
          'px: avatar, shared Maps component, bell anchor, navbar layout and refusal.',
      );
    }
  } finally {
    await browser?.close();
    await new Promise((resolve) => server.close(resolve));
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
