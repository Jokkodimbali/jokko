import { expect, test } from '@playwright/test';

const categories = [
  { id: 'cat-admin', nom: 'Administration', urlIcone: null, ordreTri: 1, tauxCommission: 0, estActive: true, subCategories: [] },
  { id: 'cat-agri', nom: 'Agriculture', urlIcone: null, ordreTri: 2, tauxCommission: 0, estActive: true, subCategories: [] },
  { id: 'cat-artisan', nom: 'Artisanat / metiers', urlIcone: null, ordreTri: 3, tauxCommission: 0, estActive: true, subCategories: [] },
  { id: 'cat-auto', nom: 'Voiture', urlIcone: null, ordreTri: 4, tauxCommission: 0, estActive: true, subCategories: [] },
  { id: 'cat-cuisine', nom: 'Cuisine', urlIcone: null, ordreTri: 5, tauxCommission: 0, estActive: true, subCategories: [] },
];

const providers = [
  {
    id: 'provider-modou',
    userId: 'user-modou',
    name: 'modou mecanicien',
    avatarUrl: null,
    companyName: 'modou mecanicien',
    bio: null,
    city: 'Dakar',
    latitude: null,
    longitude: null,
    rating: 0,
    totalReviews: 0,
    distanceKm: null,
    services: [
      {
        id: 'service-depannage',
        name: 'depannage',
        price: 5000,
        priceType: 'NEGOCIABLE',
        travelMode: 'PRESTATAIRE_SE_DEPLACE',
        categoryId: 'cat-auto',
        categoryName: 'Mecanique automobile',
        subCategoryId: null,
        subCategoryName: 'depannage',
        subCategoryNames: ['depannage'],
      },
    ],
    portfolioImages: [],
  },
  {
    id: 'provider-doctor',
    userId: 'user-doctor',
    name: 'Dr Antoine Diop',
    avatarUrl: null,
    companyName: null,
    bio: null,
    city: 'Dakar',
    latitude: null,
    longitude: null,
    rating: 0,
    totalReviews: 0,
    distanceKm: null,
    services: [
      {
        id: 'service-consultation',
        name: 'Premiere consultation',
        price: 12000,
        priceType: 'FIXE',
        travelMode: 'CLIENT_SE_DEPLACE',
        categoryId: 'cat-med',
        categoryName: 'Sante et medecine',
        subCategoryId: null,
        subCategoryName: 'Consultation',
        subCategoryNames: ['Consultation'],
      },
    ],
    specialties: [
      {
        id: 'specialty-dentiste',
        name: 'Dentiste',
        price: 12000,
        priceType: 'FIXE',
        travelMode: 'CLIENT_SE_DEPLACE',
        categoryId: 'cat-med',
        categoryName: 'Sante et medecine',
        subCategoryId: null,
        subCategoryName: 'Dentiste',
        subCategoryNames: ['Dentiste'],
      },
    ],
    portfolioImages: [],
  },
];

test('services search suggestions stay attached above page filters', async ({ page }) => {
  await page.route('**/api/v1/categories/structure', async (route) => {
    await route.fulfill({ json: { success: true, data: categories } });
  });

  await page.route('**/api/v1/search/professionals**', async (route) => {
    await route.fulfill({
      json: {
        success: true,
        data: providers,
        meta: { pagination: { total: providers.length, page: 1, limit: 6, totalPages: 1, hasNext: false, hasPrevious: false } },
      },
    });
  });

  await page.goto('/services');
  const searchInput = page.locator('.app-search-bar__field input');
  await searchInput.fill('meca');

  const suggestions = page.locator('.app-search-bar__suggestions');
  await expect(suggestions).toBeVisible();
  await expect(page.getByRole('button', { name: /^Tout voir$/ })).toHaveCount(0);

  const categoryChips = page.locator('.app-search-bar__category-chip');
  await expect(categoryChips).toHaveCount(4);
  await expect(categoryChips.last()).toContainText('Voir plus');

  await categoryChips.last().click();
  await expect(page.locator('.app-search-bar__category-chip')).toHaveCount(6);

  const layout = await page.evaluate(() => {
    const bar = document.querySelector('.app-search-bar')?.getBoundingClientRect();
    const panel = document.querySelector('.app-search-bar__suggestions')?.getBoundingClientRect();
    if (!bar || !panel) {
      return null;
    }

    const topElement = document
      .elementFromPoint(panel.left + panel.width / 2, panel.bottom - 32)
      ?.closest('.app-search-bar__suggestions');

    return {
      verticalOffset: panel.top - bar.bottom,
      panelOwnsBottomPoint: Boolean(topElement),
    };
  });

  expect(layout).not.toBeNull();
  expect(layout?.verticalOffset).toBeLessThanOrEqual(1);
  expect(layout?.verticalOffset).toBeGreaterThanOrEqual(-8);
  expect(layout?.panelOwnsBottomPoint).toBe(true);

  await page.locator('.service-section').click({ position: { x: 10, y: 10 } });
  await expect(suggestions).toBeHidden();

  await searchInput.click();
  await expect(suggestions).toBeVisible();
});
