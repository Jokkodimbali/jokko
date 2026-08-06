import { expect, test, type Page } from '@playwright/test';

const publicRoutes = [
  '/services',
  '/auth/login',
  '/auth/register',
  '/contact',
  '/a-propos',
] as const;

const protectedProfiles = [
  {
    identifier: '+221772345678',
    password: 'client123',
    routes: ['/appointments', '/favorites', '/settings', '/notifications', '/messages', '/litiges'],
  },
  {
    identifier: '+221773456789',
    password: 'prof12345',
    routes: ['/prestataire/espace', '/appointments', '/settings', '/notifications', '/messages'],
  },
] as const;

const viewports = [
  { name: 'mobile-320', width: 320, height: 700 },
  { name: 'mobile-390', width: 390, height: 844 },
  { name: 'tablet-768', width: 768, height: 1024 },
  { name: 'desktop-1440', width: 1440, height: 900 },
] as const;

test.describe('Responsivite globale sans debordement', () => {
  for (const viewport of viewports) {
    test.describe(viewport.name, () => {
      test.use({ viewport: { width: viewport.width, height: viewport.height } });

      for (const route of publicRoutes) {
        test(`${route} reste dans le viewport`, async ({ page }) => {
          await page.goto(route);
          await waitForStableLayout(page);
          await expectResponsiveLayout(page, route);
        });
      }

      for (const profile of protectedProfiles) {
        test(`espace ${profile.identifier} reste dans le viewport`, async ({ page }) => {
          await login(page, profile.identifier, profile.password);

          for (const route of profile.routes) {
            await page.goto(route);
            await waitForStableLayout(page);
            await expectResponsiveLayout(page, route);

            if (route === '/appointments') {
              await auditFirstLinkedPage(
                page,
                'a[href^="/appointments/"]:not([href*="/payment"])',
                'detail rendez-vous',
              );
            }

            if (route === '/prestataire/espace') {
              await auditDoctorSpaceSections(page);
            }
          }

          await auditReservationEntry(page);
        });
      }
    });
  }
});

async function login(page: Page, identifier: string, password: string): Promise<void> {
  await page.goto('/auth/login');
  await waitForStableLayout(page);

  const inputs = page.locator('input');
  await inputs.nth(0).fill(identifier);
  await inputs.nth(1).fill(password);
  await page.locator('button[type="submit"], button:has-text("Se connecter")').first().click();
  await page.waitForURL('**/services', { timeout: 15_000 });
}

async function auditFirstLinkedPage(page: Page, selector: string, label: string): Promise<void> {
  const href = await page
    .locator(selector)
    .first()
    .getAttribute('href')
    .catch(() => null);
  if (!href) {
    return;
  }

  await page.goto(href);
  await waitForStableLayout(page);
  await expectResponsiveLayout(page, label);
}

async function auditDoctorSpaceSections(page: Page): Promise<void> {
  const sectionButtons = page.locator('app-doctor-space-sidebar nav button');
  const count = await sectionButtons.count();

  for (let index = 0; index < count; index += 1) {
    const button = sectionButtons.nth(index);
    const label = (await button.innerText()).trim();
    await button.click();
    await page.waitForTimeout(180);
    await expectResponsiveLayout(page, `espace prestataire - ${label}`);
  }
}

async function auditReservationEntry(page: Page): Promise<void> {
  await page.goto('/services');
  await waitForStableLayout(page);

  const providerHref = await page
    .locator('a[href^="/services/"]:not([href*="proposition"])')
    .first()
    .getAttribute('href')
    .catch(() => null);
  if (!providerHref) {
    return;
  }

  await page.goto(providerHref);
  await waitForStableLayout(page);
  await expectResponsiveLayout(page, 'profil prestataire');

  const proposalHref = await page
    .locator('a[href$="/proposition"]')
    .first()
    .getAttribute('href')
    .catch(() => null);
  if (!proposalHref) {
    return;
  }

  await page.goto(proposalHref);
  await waitForStableLayout(page);
  await expectResponsiveLayout(page, 'etapes de reservation');
}

async function waitForStableLayout(page: Page): Promise<void> {
  await page.waitForLoadState('domcontentloaded');
  // Realtime sockets, maps and polling legitimately keep authenticated pages busy.
  // A short quiet-window is enough to catch the final responsive layout without
  // turning the audit into a backend availability test.
  await page.waitForLoadState('networkidle', { timeout: 2_000 }).catch(() => undefined);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(180);
}

async function expectResponsiveLayout(page: Page, route: string): Promise<void> {
  const report = await page.evaluate(() => {
    const viewportWidth = document.documentElement.clientWidth;
    const pageOverflow =
      Math.max(document.documentElement.scrollWidth, document.body.scrollWidth) - viewportWidth;
    const offenders = [...document.querySelectorAll<HTMLElement>('body *')]
      .filter((element) => {
        const closedDrawer = element.closest(
          '.app-navbar__mobile-drawer:not(.app-navbar__mobile-drawer--open)',
        );
        if (closedDrawer || element.closest('[aria-hidden="true"], [inert]')) {
          return false;
        }

        const style = getComputedStyle(element);
        if (
          style.display === 'none' ||
          style.visibility === 'hidden' ||
          style.position === 'fixed' ||
          style.opacity === '0'
        ) {
          return false;
        }

        let ancestor = element.parentElement;
        let clippingContainer = false;
        while (ancestor && ancestor !== document.body) {
          const overflow = getComputedStyle(ancestor).overflowX;
          if (
            overflow === 'auto' ||
            overflow === 'scroll' ||
            overflow === 'hidden' ||
            overflow === 'clip'
          ) {
            clippingContainer = true;
            break;
          }
          ancestor = ancestor.parentElement;
        }
        if (clippingContainer) {
          return false;
        }

        const rect = element.getBoundingClientRect();
        return rect.width > 0 && (rect.left < -2 || rect.right > viewportWidth + 2);
      })
      .slice(0, 12)
      .map((element) => {
        const rect = element.getBoundingClientRect();
        return {
          element: `${element.tagName.toLowerCase()}.${[...element.classList].slice(0, 2).join('.')}`,
          left: Math.round(rect.left),
          right: Math.round(rect.right),
          width: Math.round(rect.width),
        };
      });

    return { pageOverflow: Math.round(pageOverflow), offenders };
  });

  expect(
    report.pageOverflow,
    `${route}: debordement global ${JSON.stringify(report)}`,
  ).toBeLessThanOrEqual(2);
  expect(report.offenders, `${route}: elements hors viewport`).toEqual([]);
}
