import { expect, test, type Page } from '@playwright/test';

const profiles = [
  {
    label: 'client',
    identifier: '+221772345678',
    password: 'client123',
    routes: ['/appointments', '/favorites', '/settings', '/notifications', '/messages'],
  },
  {
    label: 'prestataire',
    identifier: '+221773456789',
    password: 'prof12345',
    routes: ['/prestataire/espace', '/appointments', '/settings', '/notifications', '/messages'],
  },
  {
    label: 'admin',
    identifier: '+221771234567',
    password: 'admin123',
    routes: ['/admin'],
  },
] as const;

const publicRoutes = ['/services', '/medecine', '/auth/login'] as const;

test.describe('Jokko smoke browser checks', () => {
  for (const route of publicRoutes) {
    test(`page publique ${route}`, async ({ page }) => {
      const errors = collectPageErrors(page);

      await page.goto(route);
      await waitForPageReady(page);

      await expect(page.locator('body')).toContainText(/Services|Médecine|Connexion/);
      expect(await hasRuntimeOverlay(page)).toBe(false);
      expect(errors.applicationErrors()).toEqual([]);
    });
  }

  for (const profile of profiles) {
    test(`connexion et routes protegees ${profile.label}`, async ({ page }) => {
      const errors = collectPageErrors(page);

      await login(page, profile.identifier, profile.password);

      for (const route of profile.routes) {
        await page.goto(route);
        await waitForPageReady(page);

        await expect(page.locator('body')).not.toContainText(
          'Connectez-vous d abord pour acceder a cet espace.',
        );
        expect(await hasRuntimeOverlay(page)).toBe(false);
      }

      expect(errors.applicationErrors()).toEqual([]);
    });
  }
});

async function login(page: Page, identifier: string, password: string): Promise<void> {
  await page.goto('/auth/login');
  await waitForPageReady(page);

  const inputs = page.locator('input');
  await inputs.nth(0).fill(identifier);
  await inputs.nth(1).fill(password);

  const responsePromise = page.waitForResponse((response) =>
    response.url().includes('/api/v1/auth/login'),
  );
  await page.locator('button[type="submit"], button:has-text("Se connecter")').first().click();
  const response = await responsePromise;

  expect(response.ok()).toBe(true);
  await page.waitForURL('**/services');
  await waitForPageReady(page);
}

async function waitForPageReady(page: Page): Promise<void> {
  await page.waitForLoadState('domcontentloaded');
  await page.waitForLoadState('networkidle', { timeout: 12_000 }).catch(() => undefined);
  await page.waitForTimeout(300);
}

async function hasRuntimeOverlay(page: Page): Promise<boolean> {
  return (
    (await page
      .locator('text=/Application error|Internal Server Error|NG0\\d+|Cannot GET/i')
      .count()) > 0
  );
}

function collectPageErrors(page: Page) {
  const consoleErrors: string[] = [];
  const failedRequests: string[] = [];
  const badResponses: string[] = [];

  page.on('console', (message) => {
    if (message.type() === 'error') {
      consoleErrors.push(message.text());
    }
  });

  page.on('requestfailed', (request) => {
    const url = request.url();
    const failure = request.failure()?.errorText ?? 'request failed';

    if (
      failure === 'net::ERR_ABORTED' ||
      failure === 'NS_BINDING_ABORTED' ||
      failure === 'Load request cancelled'
    ) {
      return;
    }

    failedRequests.push(`${request.method()} ${url} ${failure}`);
  });

  page.on('response', (response) => {
    if (response.status() >= 400) {
      badResponses.push(`${response.status()} ${response.url()}`);
    }
  });

  return {
    applicationErrors: () =>
      [...consoleErrors, ...failedRequests, ...badResponses].filter((message) => {
        if (message === 'Failed to load resource: the server responded with a status of 403 ()') {
          return false;
        }

        if (message.includes('accounts.google.com/gsi')) {
          return false;
        }

        if (message.includes('[GSI_LOGGER]')) {
          return false;
        }

        if (message.includes('googleusercontent.com') && message.includes('ERR_BLOCKED_BY_ORB')) {
          return false;
        }

        return true;
      }),
  };
}
