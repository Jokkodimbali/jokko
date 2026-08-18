import { expect, test, type Page } from '@playwright/test';

test('le client choisit consultation ou teleconsultation sans debordement', async ({ page }) => {
  const email = process.env['E2E_CLIENT_EMAIL'];
  const password = process.env['E2E_CLIENT_PASSWORD'];
  const doctorId = process.env['E2E_DOCTOR_ID'];
  test.skip(!email || !password || !doctorId, 'Compte client ou medecin de test absent');

  await login(page, email!, password!);
  await page.goto(`/medecine/${doctorId}/rendez-vous`, { waitUntil: 'domcontentloaded' });

  const classic = page.getByRole('button', { name: /Consultation Rendez-vous physique/i });
  const remote = page.getByRole('button', { name: /Téléconsultation Consultation médicale/i });
  await expect(classic).toBeVisible();
  await expect(remote).toBeVisible();
  await expect(classic).toHaveClass(/is-active/);
  await remote.click();
  await expect(remote).toHaveClass(/is-active/);
  await expect(classic).not.toHaveClass(/is-active/);

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});

async function login(page: Page, email: string, password: string): Promise<void> {
  await page.goto('/auth/login', { waitUntil: 'domcontentloaded' });
  await page.locator('#loginIdentifier').fill(email);
  await page.locator('#password').fill(password);
  await page.getByRole('button', { name: 'Se connecter' }).click();
  await expect(page).not.toHaveURL(/\/auth\/login/, { timeout: 20_000 });
}
