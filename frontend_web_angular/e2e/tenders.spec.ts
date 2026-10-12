import { expect, test, type Page } from '@playwright/test';
import type { Tender } from '../src/app/features/tenders/data-access/tenders.models';
const categoryId = 'b8bdf735-f4b4-4dd4-b58b-0b317046d154';
function fixture(): Tender {
  return {
    id: '566155da-1c19-4de4-a31c-3c3e8d69f99e',
    categoryId,
    subCategoryId: null,
    job: 'Plomberie',
    description: 'Réparer une fuite sous le lavabo de la cuisine.',
    address: 'Mermoz, Dakar',
    latitude: 14.69,
    longitude: -17.46,
    radiusKm: 25,
    proposedPrice: 10000,
    scheduledAt: null,
    status: 'OPEN',
    revision: 1,
    createdAt: '2026-10-08T10:00:00Z',
    clientName: 'Mamadou Dia',
    clientAvatarUrl: null,
    invitedCount: 1,
    responses: [
      {
        id: 'response',
        professionalId: 'professional',
        name: 'Awa Ndiaye',
        avatarUrl: null,
        rating: 4.8,
        reviewCount: 126,
        distanceKm: 1.4,
        amount: 12000,
        message: 'Disponible pour intervenir.',
        status: 'OFFERED',
        offeredAt: '2026-10-08T10:01:00Z',
        serviceId: 'service',
        serviceName: 'Réparation plomberie',
        serviceDurationMinutes: 60,
        negotiationId: null,
        reservationId: null,
        services: [{ id: 'service', name: 'Réparation plomberie' }],
      },
    ],
  };
}
async function setup(
  page: Page,
  role: 'CLIENT' | 'PRESTATAIRE' | 'MEDECIN',
  state: { tender: Tender | null },
) {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.addInitScript(
    ({ role }) => {
      const user = {
        id: role === 'CLIENT' ? 'client' : 'provider',
        name: role === 'CLIENT' ? 'Mamadou Dia' : 'Awa Ndiaye',
        phoneNumber: '+221770000000',
        role,
      };
      const token = `test.${btoa(JSON.stringify({ sub: user.id, role, exp: 4102444800 }))}.test`;
      localStorage.setItem('currentUser', JSON.stringify(user));
      localStorage.setItem('accessToken', token);
      localStorage.setItem('authStorageMode', 'local');
    },
    { role },
  );
  await page.route('**/api/v1/**', async (route) => {
    const path = new URL(route.request().url()).pathname.replace('/api/v1', '');
    let data: unknown = [];
    if (path === '/users/me') {
      data = {
        id: role === 'CLIENT' ? 'client' : 'provider',
        nom: role === 'CLIENT' ? 'Mamadou Dia' : 'Awa Ndiaye',
        role,
        telephone: '+221770000000',
        estActif: true,
      };
    }
    if (path === '/categories/structure')
      data = [
        {
          id: categoryId,
          nom: 'Plomberie',
          typeEspace: 'PRESTATAIRE',
          estActive: true,
          subCategories: [
            { id: 'c9b92f8e-31f3-4ca8-9494-712c3f241be2', nom: 'Plombier', estActive: true },
            {
              id: '1e1dc743-9de0-42f8-b529-e1e2aef9bfca',
              nom: 'Plombier dépanneur',
              estActive: true,
            },
          ],
        },
        {
          id: 'medical',
          nom: 'Médecine générale',
          typeEspace: 'MEDECIN',
          estActive: true,
          subCategories: [],
        },
      ];
    else if (path === '/maps/config') data = { browserApiKey: '', mapId: '' };
    else if (path.startsWith('/maps/geocode'))
      data = {
        latitude: 14.69,
        longitude: -17.46,
        formattedAddress: 'Mermoz, Dakar',
        placeId: 'test',
      };
    else if (path.startsWith('/maps/reverse-geocode'))
      data = {
        latitude: 14.69,
        longitude: -17.46,
        formattedAddress: 'Mermoz, Dakar',
        placeId: 'test',
      };
    else if (path === '/calls/active') data = null;
    else if (path === '/tenders/preview') {
      data = {
        count: 2,
        avatars: [
          { name: 'Awa Ndiaye', avatarUrl: null },
          { name: 'Ibra Fall', avatarUrl: null },
        ],
      };
    } else if (path.startsWith('/tenders')) {
      if (route.request().method() === 'POST') {
        const body = route.request().postDataJSON();
        if (path === '/tenders') {
          state.tender = fixture();
          state.tender.responses = [];
          Object.assign(state.tender, body);
        } else if (path.endsWith('/select')) {
          state.tender!.status = 'SELECTED';
          state.tender!.responses[0].status = 'SELECTED';
          state.tender!.responses[0].negotiationId = 'negotiation';
        } else if (path.endsWith('/respond')) {
          state.tender!.responses[0].status = 'OFFERED';
          state.tender!.responses[0].amount = body.amount;
        } else if (path.endsWith('/reject')) {
          state.tender!.responses[0].status = 'REJECTED';
        } else if (path.endsWith('/cancel')) {
          state.tender!.status = 'CANCELLED';
        }
        data = state.tender;
      } else
        data =
          path === '/tenders'
            ? (() => {
                const answeredOnly = new URL(route.request().url()).searchParams.get('answeredOnly') === 'true';
                const items = state.tender && state.tender.status !== 'CANCELLED' && (!answeredOnly || state.tender.responses.some(
                  (response) => response.status === 'OFFERED' || response.status === 'SELECTED',
                )) ? [state.tender] : [];
                return { items, total: items.length, page: 1, limit: 20 };
              })()
            : state.tender;
    }
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data }),
    });
  });
  await page.route('**/socket.io/**', (route) => route.abort());
  return errors;
}
async function noOverflow(page: Page) {
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
  ).toBe(true);
}
test('client searches the catalogue and publishes', async ({ page }) => {
  const state = { tender: null as Tender | null };
  const errors = await setup(page, 'CLIENT', state);
  await page.goto('/appels-offres');
  await expect(page.getByRole('heading', { name: 'Proposez votre prix' })).toBeVisible();
  await expect(page.locator('app-navbar')).toBeVisible();
  await expect(page.getByLabel('Date souhaitée')).toBeVisible();
  await expect(page.getByLabel('Heure souhaitée')).toBeVisible();
  await page.getByRole('searchbox', { name: 'Rechercher un métier' }).fill('plomb');
  await expect(page.getByRole('button', { name: 'Plombier', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Plomberie', exact: true }).click();
  await page
    .getByPlaceholder('Décrivez votre besoin, le problème rencontré et les précisions utiles…')
    .fill('Réparer une fuite sous le lavabo.');
  await page.getByRole('searchbox', { name: 'Rechercher une adresse' }).fill('Mermoz');
  await page.getByRole('button', { name: "Rechercher l'adresse", exact: true }).click();
  await expect(page.locator('.map-address')).toContainText('Mermoz, Dakar');
  await expect(page.getByText('2 prestataires disponibles')).toBeVisible();
  await noOverflow(page);
  await page.screenshot({
    path: `/tmp/jokko-tenders-client-${test.info().project.name}.png`,
    fullPage: true,
  });
  await page.getByRole('button', { name: 'Publier ma demande', exact: true }).click();
  await expect(page.getByText('Choisissez une date.', { exact: true })).toBeVisible();
  await expect(page.getByText('Choisissez une heure.', { exact: true })).toBeVisible();
  const publishDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  await page.getByLabel('Date souhaitée').fill(publishDate.toISOString().slice(0, 10));
  await page.getByLabel('Heure souhaitée').fill('10:00');
  await page.getByRole('button', { name: 'Publier ma demande', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Offres reçues' })).toBeVisible();
  expect(state.tender?.description).toBe('Réparer une fuite sous le lavabo.');
  expect(errors).toEqual([]);
});
test('client sees errors by each required field and may omit the description', async ({ page }) => {
  const state: { tender: Tender | null } = { tender: null };
  await setup(page, 'CLIENT', state);
  await page.goto('/appels-offres');
  await page.getByRole('button', { name: 'Publier ma demande', exact: true }).click();
  await expect(page.getByText('Sélectionnez un métier dans les résultats de recherche.')).toBeVisible();
  await expect(page.getByText('Choisissez une adresse sur la carte (180 caractères maximum).')).toBeVisible();
  await expect(page.getByText('Choisissez une date.')).toBeVisible();
  await expect(page.getByText('Choisissez une heure.')).toBeVisible();
  expect(state.tender).toBeNull();
  await page.getByRole('searchbox', { name: 'Rechercher un métier' }).fill('plomb');
  await page.getByRole('button', { name: 'Plomberie', exact: true }).click();
  await page.getByRole('searchbox', { name: 'Rechercher une adresse' }).fill('Mermoz');
  await page.getByRole('button', { name: "Rechercher l'adresse", exact: true }).click();
  const publishDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  await page.getByLabel('Date souhaitée').fill(publishDate.toISOString().slice(0, 10));
  await page.getByLabel('Heure souhaitée').fill('10:00');
  await page.getByRole('button', { name: 'Publier ma demande', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Offres reçues' })).toBeVisible();
  expect(state.tender?.description).toBe('');
});
test('medical jobs are excluded from the tender catalogue', async ({ page }) => {
  await setup(page, 'CLIENT', { tender: null });
  await page.goto('/appels-offres');
  await page.getByRole('searchbox', { name: 'Rechercher un métier' }).fill('médecine');
  await expect(page.getByRole('button', { name: 'Médecine générale' })).toHaveCount(0);
});
test('chooses an address on the fallback map when Google authentication fails', async ({
  page,
}) => {
  await setup(page, 'CLIENT', { tender: null });
  await page.route('**/api/v1/maps/config', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: { browserApiKey: 'test-key', mapId: '' } }),
    }),
  );
  await page.route('**/maps.googleapis.com/maps/api/js?**', (route) =>
    route.fulfill({ contentType: 'text/javascript', body: 'window.gm_authFailure?.();' }),
  );
  await page.goto('/appels-offres');
  await expect(page.locator('.interactive-map__fallback-map.leaflet-container')).toBeVisible();
  await page.locator('.interactive-map__fallback-map').click({ position: { x: 100, y: 100 } });
  await expect(page.locator('.map-address')).toContainText('Mermoz, Dakar');
});
test('doctor accounts cannot open tender pages', async ({ page }) => {
  await setup(page, 'MEDECIN', { tender: null });
  await page.goto('/appels-offres');
  await expect(page).toHaveURL(/\/medecine\/espace/);
  await expect(page.locator('app-navbar a[href="/appels-offres"]')).toHaveCount(0);
});
test('client accepts a counter-offer and continues to reservation', async ({ page }) => {
  const state = { tender: fixture() };
  const errors = await setup(page, 'CLIENT', state);
  await page.route('**/api/v1/reservations/from-negotiation', (route) =>
    route.fulfill({ contentType: 'application/json', body: JSON.stringify({ success: true, data: { id: 'reservation' } }) }),
  );
  await page.goto(`/appels-offres/${state.tender.id}`);
  await expect(page.locator('app-navbar')).toBeVisible();
  await expect(page.getByText('Awa Ndiaye', { exact: true })).toBeVisible();
  await noOverflow(page);
  await page.screenshot({
    path: `/tmp/jokko-tenders-offers-${test.info().project.name}.png`,
    fullPage: true,
  });
  await page.getByRole('button', { name: /Accepter 12/ }).click();
  await expect(page.getByRole('heading', { name: 'Offre acceptée' })).toBeVisible();
  expect(state.tender.status).toBe('SELECTED');
  await page.getByRole('button', { name: 'Finaliser la réservation' }).click();
  await expect(page.getByText('Choisissez une date et une heure futures.', { exact: true })).toBeVisible();
  const date = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 16);
  await page.getByLabel('Date et heure de l’intervention').first().fill(date);
  await page.getByRole('button', { name: 'Finaliser la réservation' }).click();
  await expect(page).toHaveURL(/\/appointments\/reservation\/payment/);
  expect(errors).toEqual([]);
});
test('a dated accepted offer opens the existing payment page', async ({ page }) => {
  const state = { tender: fixture() };
  const scheduledAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  state.tender.scheduledAt = scheduledAt;
  await setup(page, 'CLIENT', state);
  let reservationPayload: Record<string, unknown> | null = null;
  await page.route('**/api/v1/reservations/from-negotiation', async (route) => {
    reservationPayload = route.request().postDataJSON();
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ success: true, data: { id: 'reservation' } }) });
  });
  await page.goto(`/appels-offres/${state.tender.id}`);
  await page.getByRole('button', { name: /Accepter 12/ }).click();
  await expect(page.getByRole('heading', { name: 'Offre acceptée' })).toBeVisible();
  await page.getByRole('button', { name: 'Finaliser la réservation' }).click();
  await expect(page).toHaveURL(/\/appointments\/reservation\/payment/);
  expect(reservationPayload).toMatchObject({ negotiationId: 'negotiation', dateHeure: scheduledAt, dureeMinutes: 60, adresseClient: state.tender.address });
});
test('a chosen date is retained and a missing service duration uses the standard duration', async ({ page }) => {
  const state = { tender: fixture() };
  const scheduledAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  state.tender.scheduledAt = scheduledAt;
  state.tender.responses[0].serviceDurationMinutes = null;
  await setup(page, 'CLIENT', state);
  let reservationPayload: Record<string, unknown> | null = null;
  await page.route('**/api/v1/reservations/from-negotiation', async (route) => {
    reservationPayload = route.request().postDataJSON();
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify({ success: true, data: { id: 'reservation' } }) });
  });
  await page.goto(`/appels-offres/${state.tender.id}`);
  await page.getByRole('button', { name: /Accepter 12/ }).click();
  await expect(page.getByLabel('Durée estimée de l’intervention (minutes)')).toHaveCount(0);
  await page.getByRole('button', { name: 'Finaliser la réservation' }).click();
  await expect(page).toHaveURL(/\/appointments\/reservation\/payment/);
  expect(reservationPayload).toMatchObject({ dateHeure: scheduledAt, dureeMinutes: 60 });
});
test('client can finish booking after a temporary reservation error', async ({ page }) => {
  const state = { tender: fixture() };
  state.tender.scheduledAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  await setup(page, 'CLIENT', state);
  let attempts = 0;
  await page.route('**/api/v1/reservations/from-negotiation', async (route) => {
    attempts++;
    await route.fulfill({
      status: attempts === 1 ? 503 : 200,
      contentType: 'application/json',
      body: JSON.stringify(attempts === 1
        ? { success: false, message: 'Service indisponible' }
        : { success: true, data: { id: 'reservation' } }),
    });
  });
  await page.goto(`/appels-offres/${state.tender.id}`);
  await page.getByRole('button', { name: /Accepter 12/ }).click();
  await expect(page.getByRole('heading', { name: 'Offre acceptée' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Finaliser la réservation' })).toBeVisible();
  await page.getByRole('button', { name: 'Finaliser la réservation' }).click();
  await expect(page.getByRole('alert')).toContainText('Service indisponible');
  await page.getByRole('button', { name: 'Finaliser la réservation' }).click();
  await expect(page).toHaveURL(/\/appointments\/reservation\/payment/);
  expect(attempts).toBe(2);
});
test('a refused client offer disappears while the request stays open', async ({ page }) => {
  const state = { tender: fixture() };
  await setup(page, 'CLIENT', state);
  await page.goto(`/appels-offres/${state.tender.id}`);
  await expect(page.locator('.tender-offer')).toHaveCount(1);
  await page.getByRole('button', { name: 'Refuser' }).click();
  await expect(page.locator('.tender-offer')).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Les offres apparaîtront ici' })).toBeVisible();
  expect(state.tender.status).toBe('OPEN');
});
test('client sees accepted price and counter-offers from the returned responses', async ({
  page,
}) => {
  const tender = fixture();
  tender.invitedCount = 2;
  tender.responses = [
    {
      ...tender.responses[0],
      id: 'base-offer',
      name: 'Aminata Ba',
      serviceName: 'Menuiserie',
      amount: tender.proposedPrice,
      distanceKm: 1.9,
      message: null,
    },
    { ...tender.responses[0], id: 'counter-offer', name: 'Cheikh Ndiaye', amount: 11000 },
  ];
  await setup(page, 'CLIENT', { tender });
  await page.goto(`/appels-offres/${tender.id}`);
  await expect(page.locator('.tender-offer')).toHaveCount(2);
  await expect(page.getByText('Accepte votre prix')).toBeVisible();
  await expect(page.getByText('Contre-offre', { exact: true })).toBeVisible();
  await expect(page.getByText('2 prestataires sollicités')).toBeVisible();
  await expect(page.getByText('Menuiserie', { exact: true })).toBeVisible();
  await expect(page.getByText('+1 000 FCFA')).toBeVisible();
  await noOverflow(page);
  await page.screenshot({
    path: `/tmp/jokko-tenders-multiple-offers-${test.info().project.name}.png`,
    fullPage: true,
  });
});
test('client sees a new response without reloading the page', async ({ page }) => {
  const tender = fixture();
  tender.responses[0].status = 'INVITED';
  tender.responses[0].amount = null;
  const state = { tender };
  await setup(page, 'CLIENT', state);
  await page.goto(`/appels-offres/${tender.id}`);
  await expect(page.getByText('Les offres apparaîtront ici')).toBeVisible();
  state.tender.responses[0].status = 'OFFERED';
  state.tender.responses[0].amount = 10000;
  await expect(page.getByText('Accepte votre prix')).toBeVisible({ timeout: 8000 });
});
test('Mes demandes lists provider replies only, as they arrive', async ({ page }) => {
  const tender = fixture();
  tender.responses[0].status = 'INVITED';
  tender.responses[0].amount = null;
  const state = { tender };
  await setup(page, 'CLIENT', state);
  await page.goto('/appels-offres');
  await expect(page.getByRole('heading', { name: 'Aucune réponse reçue' })).toBeVisible();
  await expect(page.locator('.client-response-card')).toHaveCount(0);
  state.tender.responses[0].status = 'OFFERED';
  state.tender.responses[0].amount = 12000;
  await expect(page.locator('.client-response-card')).toHaveCount(1, { timeout: 8000 });
  await expect(page.locator('.client-response-card')).toContainText('Awa Ndiaye');
  await expect(page.locator('.client-response-card')).toContainText('12 000 FCFA');
  await expect(page.locator('.client-response-card')).toHaveAttribute('href', `/appels-offres/${tender.id}`);
});
test('a cancelled request immediately leaves the client list', async ({ page }) => {
  const tender = fixture();
  const state = { tender };
  await setup(page, 'CLIENT', state);
  await page.goto(`/appels-offres/${tender.id}`);
  await page.getByRole('button', { name: 'Annuler la demande' }).click();
  await page.getByRole('button', { name: 'Confirmer l’annulation' }).click();
  await expect(page).toHaveURL(/\/appels-offres$/);
  await expect(page.locator('.client-response-card')).toHaveCount(0);
});
test('provider sends a counter-offer', async ({ page }) => {
  const tender = fixture();
  tender.responses[0].status = 'INVITED';
  tender.responses[0].amount = null;
  const state = { tender };
  const errors = await setup(page, 'PRESTATAIRE', state);
  await page.goto('/appels-offres');
  await expect(page.getByRole('heading', { name: 'Demandes à proximité' })).toBeVisible();
  await expect(page.locator('.provider-request')).toHaveCount(1);
  await expect(page.locator('.provider-request a[href*="/appels-offres/"]')).toHaveCount(0);
  await expect(page.getByText('Service proposé')).toHaveCount(0);
  await page.getByRole('button', { name: 'Contre-offre', exact: true }).click();
  await page.getByLabel('Montant en FCFA', { exact: true }).fill('12500');
  await noOverflow(page);
  await page.screenshot({
    path: `/tmp/jokko-tenders-provider-${test.info().project.name}.png`,
    fullPage: true,
  });
  await page.getByRole('button', { name: /Envoyer 12/ }).click();
  await expect(page.getByText('En attente du client', { exact: true })).toBeVisible();
  await expect(page.locator('.provider-request')).toContainText('12 500 FCFA');
  await expect(page.getByRole('link', { name: 'Consulter le suivi' })).toHaveCount(0);
  expect(state.tender.responses[0].amount).toBe(12500);
  expect(errors).toEqual([]);
});
test('provider can send another offer after the client refuses the first', async ({ page }) => {
  const tender = fixture();
  tender.responses[0].status = 'REJECTED';
  const state = { tender };
  const errors = await setup(page, 'PRESTATAIRE', state);
  await page.goto('/appels-offres');
  await expect(page.getByRole('heading', { name: 'Mes offres envoyées' })).toBeVisible();
  await page.getByRole('button', { name: 'Faire une nouvelle contre-offre' }).click();
  await page.getByRole('textbox', { name: 'Montant en FCFA' }).fill('11000');
  await page.getByRole('button', { name: /Envoyer 11/ }).click();
  await expect(page.getByText('En attente du client', { exact: true })).toBeVisible();
  expect(state.tender.responses[0].amount).toBe(11000);
  expect(errors).toEqual([]);
});
test('provider accepts a new request directly from its card', async ({ page }) => {
  const tender = fixture();
  tender.responses[0].status = 'INVITED';
  tender.responses[0].amount = null;
  const state = { tender };
  await setup(page, 'PRESTATAIRE', state);
  await page.goto('/appels-offres');
  await page.getByRole('button', { name: 'Accepter 10 000' }).click();
  await expect(page.getByRole('heading', { name: 'Mes offres envoyées' })).toBeVisible();
  await expect(page.getByText('En attente du client', { exact: true })).toBeVisible();
  expect(state.tender.responses[0].amount).toBe(10000);
});
test('provider counter-offer opens inside the request card with a live price difference', async ({ page }) => {
  const tender = fixture();
  tender.proposedPrice = 8000;
  tender.responses[0].status = 'INVITED';
  tender.responses[0].amount = null;
  tender.responses[0].services = [
    { id: 'unrelated-service', name: 'Débouchage' },
    { id: 'service', name: 'Plomberie' },
  ];
  await setup(page, 'PRESTATAIRE', { tender });
  await page.goto('/appels-offres');
  await page.getByRole('button', { name: 'Contre-offre', exact: true }).click();
  const card = page.locator('.provider-request');
  await expect(card.getByText('Votre contre-offre', { exact: true })).toBeVisible();
  await expect(card.getByText('+1 000 FCFA vs client')).toBeVisible();
  await expect(card.getByRole('textbox', { name: 'Montant en FCFA' })).toHaveValue(/9\s000/);
  await expect(card.getByRole('button', { name: 'Contre-offre', exact: true })).toHaveCount(0);
  await expect(card.getByRole('button', { name: 'Envoyer 9 000 FCFA' })).toBeVisible();
  await expect(card.getByText('Service proposé')).toHaveCount(0);
  await noOverflow(page);
  await page.screenshot({ path: `/tmp/jokko-provider-counter-${test.info().project.name}.png`, fullPage: true });
  const request = page.waitForRequest((sent) => sent.url().endsWith('/respond') && sent.method() === 'POST');
  await card.getByRole('button', { name: 'Envoyer 9 000 FCFA' }).click();
  expect((await request).postDataJSON()).toMatchObject({ serviceId: 'service', amount: 9000 });
});
test('provider deep links return to the cards instead of a tender detail page', async ({ page }) => {
  const tender = fixture();
  tender.responses[0].status = 'INVITED';
  tender.responses[0].amount = null;
  await setup(page, 'PRESTATAIRE', { tender });
  await page.goto(`/appels-offres/${tender.id}`);
  await expect(page).toHaveURL(/\/appels-offres$/);
  await expect(page.locator('.provider-request')).toHaveCount(1);
  await expect(page.getByText('Service proposé')).toHaveCount(0);
});
