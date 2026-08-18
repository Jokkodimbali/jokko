import { expect, test, type Page } from '@playwright/test';

const accounts = [
  { label: 'client', emailEnv: 'E2E_CLIENT_EMAIL', passwordEnv: 'E2E_CLIENT_PASSWORD' },
  { label: 'prestataire', emailEnv: 'E2E_PROVIDER_EMAIL', passwordEnv: 'E2E_PROVIDER_PASSWORD' },
] as const;

for (const account of accounts) {
  test(`${account.label}: notifications reelles et redirection du widget`, async ({ page }) => {
    const email = process.env[account.emailEnv];
    const password = process.env[account.passwordEnv];
    test.skip(!email || !password, `Identifiants ${account.label} absents`);

    await login(page, email!, password!);
    await page.goto('/notifications', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/notifications$/);
    await expect(page.getByRole('heading', { name: 'Vos alertes Jokko' })).toBeVisible();
    await expect(page.locator('.notifications-page__state')).not.toContainText(
      'Impossible de charger',
    );

    const items = page.locator('.notifications-page__item');
    const count = await items.count();
    const titles = await items.locator('h3').allTextContents();
    const featured = page.locator('.app-navbar__notification--featured').first();
    const featuredVisible = await featured.isVisible().catch(() => false);
    console.log(
      JSON.stringify({ account: account.label, count, titles, featuredVisible }),
    );

    if (featuredVisible) {
      const origin = new URL(page.url()).origin;
      await featured.click();
      await page.waitForTimeout(800);
      expect(new URL(page.url()).origin).toBe(origin);
      expect(page.url()).not.toMatch(/\/auth\/login/);
      expect(page.url()).not.toMatch(/\/notifications$/);
      console.log(JSON.stringify({ account: account.label, redirectedTo: page.url() }));
    }
  });
}

async function login(page: Page, email: string, password: string): Promise<void> {
  await page.goto('/auth/login', { waitUntil: 'domcontentloaded' });
  await page.locator('#loginIdentifier').fill(email);
  await page.locator('#password').fill(password);
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await expect(page).not.toHaveURL(/\/auth\/login/, { timeout: 20_000 });
}
