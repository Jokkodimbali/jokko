import { expect, test, type APIRequestContext, type Page } from '@playwright/test';

const apiBaseURL = process.env['E2E_API_URL'] ?? 'https://jokko-dimbali.onrender.com/api/v1';

type ApiEnvelope<T> = { data: T };
type ProfessionalProfile = {
  id: string;
  utilisateurId?: string;
  biographie?: string | null;
  nomEntreprise?: string | null;
  statutKyc?: string;
  raisonRejetKyc?: string | null;
  ville?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  noteGlobale?: number;
  nombreAvis?: number;
  creeLe?: string;
  utilisateur?: {
    id?: string;
    nom?: string;
    numeroTelephone?: string;
    urlAvatar?: string | null;
    estActif?: boolean;
  };
};
type ProfessionalService = {
  id: string;
  profilProfessionnelId?: string;
  categorieId?: string;
  nom: string;
  description?: string;
  prix: number;
  typePrix: string;
  modeDeplacement?: string;
  dureeMinutes?: number;
  estDisponible?: boolean;
  creeLe?: string;
};

test.describe('Service proposal redesign', () => {
  test.describe.configure({ timeout: 90_000 });

  test('uses dynamic data in the service, schedule and address modals and submits it', async ({
    page,
    request,
  }) => {
    const context = await loadNegotiableService(request);
    await login(page);
    await mockProviderDetail(page, context);
    await mockProposalReadState(page, context.profile.id);

    await page.goto(`/services/${context.profile.id}/proposition?serviceId=${context.service.id}`);
    await expect(page.getByRole('heading', { level: 1, name: /Reservation finale/i })).toBeVisible();

    await page.getByRole('button', { name: /Motif de pr[ée]sentation|Motif de prestation/i }).click();
    const serviceModal = page.getByRole('dialog', { name: 'service' });
    await expect(serviceModal).toBeVisible();
    await expect(serviceModal).toContainText(context.service.nom);
    await expect(serviceModal).toContainText(`${formatAmount(context.service.prix)} FCFA`);
    await serviceModal.locator('.details-modal__service').first().click();
    await expect(serviceModal).toBeHidden();

    await page.getByRole('button', { name: /Date.*heure|Date et disponibilite/i }).click();
    const scheduleModal = page.getByRole('dialog', { name: 'schedule' });
    await expect(scheduleModal).toBeVisible();
    await expect(scheduleModal.getByRole('button', { name: '10:00' })).toBeEnabled();
    await scheduleModal.getByRole('button', { name: '10:00' }).click();
    await scheduleModal.getByRole('button', { name: /Appliquer la date/i }).click();
    await expect(page.getByRole('button', { name: /Date.*heure|Date et disponibilite/i })).toContainText(
      '10:00',
    );

    const address = `Dakar Plateau test ${Date.now()}`;
    await page.getByRole('button', { name: /Adresse d'intervention/i }).click();
    const addressModal = page.getByRole('dialog', { name: 'address' });
    await addressModal.getByLabel(/Rechercher une adresse/i).fill(address);
    await addressModal.getByRole('button', { name: /Enregistrer l'adresse/i }).click();
    await page.getByRole('button', { name: /Adresse d'intervention/i }).click();
    await expect(page.getByLabel(/Rechercher une adresse/i)).toHaveValue(address);
    await page
      .getByRole('dialog', { name: 'address' })
      .getByRole('button', { name: /Fermer la modale/i })
      .click();

    let submittedPayload: Record<string, unknown> | null = null;
    await page.route('**/api/v1/negotiations', async (route) => {
      if (route.request().method() !== 'POST') {
        await route.continue();
        return;
      }

      submittedPayload = route.request().postDataJSON() as Record<string, unknown>;
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          data: {
            id: 'e2e-proposal',
            serviceId: context.service.id,
            statut: 'EN_ATTENTE_PRESTATAIRE',
            montantInitial: submittedPayload['proposedAmount'],
            montantCourant: submittedPayload['proposedAmount'],
            dateHeureProposee: submittedPayload['dateHeure'],
            adresseClientProposee: submittedPayload['adresseClient'],
            dureeMinutesProposee: submittedPayload['dureeMinutes'],
            propositions: [],
          },
        }),
      });
    });

    await page.getByRole('button', { name: /Envoyer (ma|la) proposition/i }).click();
    await expect.poll(() => submittedPayload).not.toBeNull();
    expect(submittedPayload).toMatchObject({
      serviceId: context.service.id,
      adresseClient: address,
      dureeMinutes: 60,
    });
    expect(submittedPayload?.['proposedAmount']).toEqual(expect.any(Number));
    expect(submittedPayload?.['dateHeure']).toEqual(expect.stringContaining('T10:00:00'));
  });

  test('Message au prestataire creates a conversation and redirects to messages', async ({
    page,
    request,
  }) => {
    const context = await loadNegotiableService(request);
    await login(page);
    await mockProviderDetail(page, context);
    await mockProposalReadState(page, context.profile.id);

    let conversationPayload: Record<string, unknown> | null = null;
    await page.route('**/api/v1/conversations', async (route) => {
      if (route.request().method() !== 'POST') {
        await route.continue();
        return;
      }

      conversationPayload = route.request().postDataJSON() as Record<string, unknown>;
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({ data: { id: 'e2e-conversation' } }),
      });
    });

    await page.goto(`/services/${context.profile.id}/proposition?serviceId=${context.service.id}`);
    await page.getByRole('button', { name: /Message au prestataire/i }).click();

    await expect(page).toHaveURL(/\/messages\?[^#]*conversationId=e2e-conversation/);
    expect(conversationPayload).toEqual({ professionalProfileId: context.profile.id });
  });
});

async function loadNegotiableService(request: APIRequestContext): Promise<{
  profile: ProfessionalProfile;
  service: ProfessionalService;
}> {
  try {
    const loginResponse = await request.post(`${apiBaseURL}/auth/login`, {
      data: { identifier: '+221773456789', password: 'prof12345' },
      timeout: 8_000,
    });
    expect(loginResponse.ok(), await loginResponse.text()).toBe(true);
    const loginEnvelope = (await loginResponse.json()) as ApiEnvelope<{ accessToken: string }>;
    const headers = { Authorization: `Bearer ${loginEnvelope.data.accessToken}` };

    const [profileResponse, servicesResponse] = await Promise.all([
      request.get(`${apiBaseURL}/professionals/me`, { headers, timeout: 8_000 }),
      request.get(`${apiBaseURL}/professionals/me/services`, { headers, timeout: 8_000 }),
    ]);
    expect(profileResponse.ok(), await profileResponse.text()).toBe(true);
    expect(servicesResponse.ok(), await servicesResponse.text()).toBe(true);

    const profile = ((await profileResponse.json()) as ApiEnvelope<ProfessionalProfile>).data;
    const services = ((await servicesResponse.json()) as ApiEnvelope<ProfessionalService[]>).data;
    const service = services.find(
      (candidate) => candidate.typePrix === 'NEGOCIABLE' && candidate.estDisponible !== false,
    );
    expect(service, 'Un service negociable disponible est requis pour ce test.').toBeTruthy();
    return { profile, service: service! };
  } catch {
    return createFallbackNegotiableService();
  }
}

async function login(page: Page): Promise<void> {
  await page.route('**/api/v1/auth/login', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: {
          accessToken: createTestAccessToken('CLIENT'),
          user: {
            id: 'e2e-client-user',
            phoneNumber: '+221772345678',
            name: 'Client Jokko',
            role: 'CLIENT',
            avatarUrl: null,
            professionalProfile: null,
          },
        },
      }),
    }),
  );
  await page.route('**/api/v1/auth/me', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: {
          id: 'e2e-client-user',
          numeroTelephone: '+221772345678',
          nom: 'Client Jokko',
          role: 'CLIENT',
          urlAvatar: null,
          estActif: true,
          profilProfessionnel: null,
        },
      }),
    }),
  );

  await page.goto('/auth/login');
  const inputs = page.locator('input');
  await inputs.nth(0).fill('+221772345678');
  await inputs.nth(1).fill('client123');
  const responsePromise = page.waitForResponse((response) =>
    response.url().includes('/api/v1/auth/login'),
  );
  await page.locator('button[type="submit"]').click();
  const response = await responsePromise;
  expect(response.ok(), await response.text()).toBe(true);
  await page.waitForURL('**/services');
}

function createFallbackNegotiableService(): {
  profile: ProfessionalProfile;
  service: ProfessionalService;
} {
  return {
    profile: {
      id: 'e2e-provider-profile',
      utilisateurId: 'e2e-provider-user',
      nomEntreprise: 'Nicolas Diop',
      ville: 'Dakar',
      noteGlobale: 4.8,
      nombreAvis: 198,
      creeLe: new Date().toISOString(),
      utilisateur: {
        id: 'e2e-provider-user',
        nom: 'Nicolas Diop',
        numeroTelephone: '+221773456789',
        urlAvatar: null,
        estActif: true,
      },
    },
    service: {
      id: 'e2e-service-negotiable',
      profilProfessionnelId: 'e2e-provider-profile',
      categorieId: 'e2e-category',
      nom: 'Plomberie',
      description: 'Intervention plomberie a domicile',
      prix: 5000,
      typePrix: 'NEGOCIABLE',
      modeDeplacement: 'PRESTATAIRE_SE_DEPLACE',
      dureeMinutes: 60,
      estDisponible: true,
      creeLe: new Date().toISOString(),
    },
  };
}

function createTestAccessToken(role: string): string {
  const payload = Buffer.from(JSON.stringify({ role })).toString('base64url');
  return `e30.${payload}.signature`;
}

async function mockProviderDetail(
  page: Page,
  context: { profile: ProfessionalProfile; service: ProfessionalService },
): Promise<void> {
  const profile = normalizeProfile(context.profile);
  const service = normalizeService(context.service, profile.id);

  await page.route(`**/api/v1/professionals/${profile.id}`, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: profile }),
    }),
  );
  await page.route(`**/api/v1/professionals/${profile.id}/services`, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: [service] }),
    }),
  );
  await page.route(`**/api/v1/professionals/${profile.id}/portfolio`, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: [] }),
    }),
  );
  await page.route(`**/api/v1/professionals/${profile.id}/availabilities`, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: [] }),
    }),
  );
  await page.route(`**/api/v1/professionals/${profile.id}/reviews`, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: [] }),
    }),
  );
  await page.route(`**/api/v1/professionals/${profile.id}/presence`, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: {
          professionalId: profile.id,
          isOnline: true,
          status: 'EN_LIGNE',
          lastLatitude: null,
          lastLongitude: null,
          lastAccuracyMeters: null,
          lastHeadingDegrees: null,
          lastSpeedKmh: null,
          lastLocationLabel: profile.ville ?? 'Dakar',
          lastPositionAt: null,
          lastSeenAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      }),
    }),
  );
}

async function mockProposalReadState(page: Page, professionalId: string): Promise<void> {
  await page.route('**/api/v1/negotiations/my?**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: [] }),
    }),
  );
  await page.route('**/api/v1/reservations/availability/slots?**', async (route) => {
    const url = new URL(route.request().url());
    const date = url.searchParams.get('date')!;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: {
          professionalId,
          date,
          dureeMinutes: 60,
          slots: [
            {
              dateHeure: `${date}T10:00:00.000Z`,
              label: '10:00',
              available: true,
              status: 'AVAILABLE',
              reason: 'Disponible',
            },
            {
              dateHeure: `${date}T11:00:00.000Z`,
              label: '11:00',
              available: false,
              status: 'RESERVED',
              reason: 'Deja reserve',
            },
          ],
        },
      }),
    });
  });
  await page.route('**/api/v1/reservations/availability?**', async (route) => {
    const url = new URL(route.request().url());
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: {
          available: true,
          reason: 'Disponible',
          professionalId,
          dateHeure: url.searchParams.get('dateHeure'),
          dureeMinutes: 60,
          withinAvailability: true,
          hasConflict: false,
        },
      }),
    });
  });
}

function normalizeProfile(profile: ProfessionalProfile): Required<ProfessionalProfile> {
  const createdAt = profile.creeLe ?? new Date().toISOString();
  const user = profile.utilisateur ?? {};

  return {
    id: profile.id,
    utilisateurId: profile.utilisateurId ?? user.id ?? 'e2e-provider-user',
    biographie: profile.biographie ?? 'Prestataire Jokko disponible pour une prestation negociee.',
    nomEntreprise: profile.nomEntreprise ?? 'Prestataire Jokko',
    statutKyc: profile.statutKyc ?? 'VERIFIE',
    raisonRejetKyc: profile.raisonRejetKyc ?? null,
    ville: profile.ville ?? 'Dakar',
    latitude: profile.latitude ?? null,
    longitude: profile.longitude ?? null,
    noteGlobale: profile.noteGlobale ?? 4.8,
    nombreAvis: profile.nombreAvis ?? 12,
    creeLe: createdAt,
    utilisateur: {
      id: user.id ?? 'e2e-provider-user',
      nom: user.nom ?? 'Prestataire Jokko',
      numeroTelephone: user.numeroTelephone ?? '+221773456789',
      urlAvatar: user.urlAvatar ?? null,
      estActif: user.estActif ?? true,
    },
  };
}

function normalizeService(
  service: ProfessionalService,
  profileId: string,
): Required<ProfessionalService> {
  return {
    id: service.id,
    profilProfessionnelId: service.profilProfessionnelId ?? profileId,
    categorieId: service.categorieId ?? 'e2e-category',
    nom: service.nom,
    description: service.description ?? 'Service negociable Jokko',
    prix: service.prix,
    typePrix: service.typePrix,
    modeDeplacement: service.modeDeplacement ?? 'PRESTATAIRE_SE_DEPLACE',
    dureeMinutes: service.dureeMinutes ?? 60,
    estDisponible: service.estDisponible ?? true,
    creeLe: service.creeLe ?? new Date().toISOString(),
  };
}

function formatAmount(amount: number): string {
  return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 })
    .format(amount)
    .replace(/\u202f/g, ' ');
}
