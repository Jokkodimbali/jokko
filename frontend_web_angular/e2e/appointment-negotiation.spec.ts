import { expect, test, type Page } from '@playwright/test';

test('reservation negotiation renders real appointment data with loading and animations', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));

  await login(page, '+221772345678', 'client123');
  await page.goto('/appointments');
  await page.waitForLoadState('networkidle').catch(() => undefined);

  await page.getByRole('button', { name: /Termines/i }).click();

  const detailLink = page
    .locator('a[href^="/appointments/"]')
    .filter({ hasText: /Voir|rendez-vous/i })
    .first();
  await expect(detailLink).toBeVisible();
  const detailHref = await detailLink.getAttribute('href');
  expect(detailHref).toMatch(/^\/appointments\/[a-zA-Z0-9-]+$/);

  await page.route('**/api/v1/reservations/*', async (route) => {
    if (route.request().url().includes('/tracking')) {
      await route.continue();
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 700));
    const response = await route.fetch();
    const payload = await response.json();
    const reservation = payload?.data ?? payload;
    if (reservation && typeof reservation === 'object') {
      reservation.statut = 'CONFIRMEE';
      reservation.status = 'CONFIRMEE';
    }
    await route.fulfill({ response, json: payload });
  });

  await page.goto(detailHref!);
  await expect(page.locator('app-appointment-detail-loading')).toBeVisible();
  await expect(page.locator('app-appointment-detail-loading')).toBeHidden({ timeout: 15_000 });

  const negotiation = page.locator('app-reservation-negotiation');
  await expect(negotiation).toBeVisible();
  await expect(negotiation.locator('.negotiation__provider h3')).not.toBeEmpty();
  await expect(negotiation.locator('.negotiation__details strong')).toHaveCount(3);
  await expect(negotiation.locator('input[aria-label="Montant de la negociation"]')).toHaveValue(
    /^[1-9]\d*$/,
  );
  await expect(negotiation).toContainText('FCFA');
  await expect(
    negotiation.getByRole('button', { name: /Finaliser la reservation/i }),
  ).toBeVisible();

  const statusDotAnimations = await negotiation
    .locator('.negotiation__heading strong i')
    .evaluate((element) => element.getAnimations().length);
  expect(statusDotAnimations).toBeGreaterThan(0);
  expect(errors).toEqual([]);

  await page.screenshot({
    path: 'test-results/appointment-negotiation-desktop.png',
    fullPage: true,
  });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await expect(page.locator('app-reservation-negotiation')).toBeVisible({ timeout: 15_000 });
  const mobileWidth = await page
    .locator('.negotiation__layout')
    .evaluate((element) => element.getBoundingClientRect().width);
  expect(mobileWidth).toBeLessThanOrEqual(390);
  await page.screenshot({
    path: 'test-results/appointment-negotiation-mobile.png',
    fullPage: true,
  });
});

async function login(page: Page, identifier: string, password: string): Promise<void> {
  await page.goto('/auth/login');
  const inputs = page.locator('input');
  await inputs.nth(0).fill(identifier);
  await inputs.nth(1).fill(password);
  const loginResponse = page.waitForResponse((response) =>
    response.url().includes('/api/v1/auth/login'),
  );
  await page.locator('button[type="submit"], button:has-text("Se connecter")').first().click();
  const response = await loginResponse;
  expect(response.ok(), await response.text()).toBe(true);
  await page.waitForURL('**/services', { timeout: 15_000 });
}
