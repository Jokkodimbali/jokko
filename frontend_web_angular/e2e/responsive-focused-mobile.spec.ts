import { expect, test, type Page } from '@playwright/test';

const clientIdentifier = process.env['E2E_CLIENT_IDENTIFIER'] ?? '+221772345678';
const clientPassword = process.env['E2E_CLIENT_PASSWORD'] ?? 'client123';

test.use({ viewport: { width: 320, height: 700 } });

test('favoris et suivi client restent utilisables a 320 px', async ({ page }) => {
  await login(page);

  await page.goto('/favorites', { waitUntil: 'domcontentloaded' });
  await settle(page);
  await expectNoPageOverflow(page, 'favoris');

  await page.goto('/appointments', { waitUntil: 'domcontentloaded' });
  await settle(page);
  const detailHref = await page
    .locator('a[href^="/appointments/"]:not([href*="/payment"])')
    .first()
    .getAttribute('href');

  expect(detailHref, 'un rendez-vous est necessaire pour verifier le suivi').toBeTruthy();
  await page.goto(detailHref!, { waitUntil: 'domcontentloaded' });
  await settle(page);
  await expectNoPageOverflow(page, 'suivi');

  const map = page.locator('.appointment-detail__live-map').first();
  await expect(map).toBeVisible();
  const mapBox = await map.boundingBox();
  expect(mapBox?.width ?? 0).toBeLessThanOrEqual(320);

  const guidance = page.locator('.appointment-detail__navigation-guidance');
  if (await guidance.isVisible().catch(() => false)) {
    const guidanceBox = await guidance.boundingBox();
    expect(guidanceBox?.width ?? 0).toBeLessThanOrEqual(246);
    expect(guidanceBox?.height ?? 0).toBeLessThanOrEqual(66);
  }
});

async function login(page: Page): Promise<void> {
  await page.goto('/auth/login', { waitUntil: 'domcontentloaded' });
  const inputs = page.locator('input');
  await inputs.nth(0).fill(clientIdentifier);
  await inputs.nth(1).fill(clientPassword);
  await page.locator('button[type="submit"], button:has-text("Se connecter")').first().click();
  await page.waitForURL('**/services', { timeout: 15_000 });
}

async function settle(page: Page): Promise<void> {
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(500);
}

async function expectNoPageOverflow(page: Page, label: string): Promise<void> {
  const overflow = await page.evaluate(
    () =>
      Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) -
      document.documentElement.clientWidth,
  );
  expect(overflow, `${label}: debordement horizontal`).toBeLessThanOrEqual(2);
}
