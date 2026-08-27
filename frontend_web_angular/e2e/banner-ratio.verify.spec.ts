import { expect, test, type Page } from '@playwright/test';

test('bannière Services responsive au ratio 936:220', async ({ page }, testInfo) => {
  const consoleErrors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });

  await login(page);
  await page.goto('/services');
  const banner = page.locator('.services-promo').first();
  await expect(banner).toBeVisible({ timeout: 20_000 });

  const box = await banner.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.width / box!.height).toBeCloseTo(936 / 220, 2);

  const image = banner.locator('img').first();
  await expect(image).toBeVisible();
  expect(await image.evaluate((element) => getComputedStyle(element).objectFit)).toBe('cover');

  const slides = banner.locator('.services-promo__image-link');
  const slideCount = await slides.count();
  if (slideCount > 0) {
    await expect(banner.locator('.services-promo__image-link--active')).toHaveCount(1);
  }
  if (slideCount > 1) {
    const activeBefore = await activeSlideIndex(slides);
    await expect
      .poll(() => activeSlideIndex(slides), { timeout: 5_500, intervals: [250] })
      .not.toBe(activeBefore);
    await expect(banner.locator('.services-promo__control')).toHaveCount(2);
    await expect(banner.locator('.services-promo__indicator')).toHaveCount(slideCount);
  }

  await banner.screenshot({ path: testInfo.outputPath('banner.png') });
  expect(consoleErrors.filter((message) => !message.includes('favicon'))).toEqual([]);
});

async function login(page: Page): Promise<void> {
  await page.goto('/auth/login');
  const inputs = page.locator('input');
  await inputs.nth(0).fill('+221772345678');
  await inputs.nth(1).fill('client123');
  const responsePromise = page.waitForResponse((response) =>
    response.url().includes('/api/v1/auth/login'),
  );
  await page.locator('button[type="submit"], button:has-text("Se connecter")').first().click();
  expect((await responsePromise).ok()).toBe(true);
  await page.waitForURL('**/services');
}

async function activeSlideIndex(slides: ReturnType<Page['locator']>): Promise<number> {
  return slides.evaluateAll((elements) =>
    elements.findIndex((element) =>
      element.classList.contains('services-promo__image-link--active'),
    ),
  );
}
