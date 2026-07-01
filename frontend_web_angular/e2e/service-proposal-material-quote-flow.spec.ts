import { expect, test, type Page, type Route } from '@playwright/test';

type MaterialQuoteStatus = 'EN_ATTENTE' | 'VALIDE' | 'REFUSE';

const professionalId = 'e2e-material-provider-profile';
const professionalUserId = 'e2e-material-provider-user';
const clientUserId = 'e2e-material-client-user';
const serviceId = 'e2e-material-service';
const negotiationId = 'e2e-material-negotiation';
const reservationId = 'e2e-material-reservation';
const scheduledAt = '2026-07-03T10:00:00.000Z';
const address = 'Dakar Plateau, Rue Test';

test.describe('Service proposal material quote acceptance flow', () => {
  test('keeps price acceptance disabled until material quote state is loaded', async ({ page }) => {
    await mockCommonServiceProposalRoutes(page);
    await mockClientNegotiationRoutes(page, {
      getQuoteStatus: () => 'EN_ATTENTE',
      quoteDelayMs: 600,
    });

    await loginAsClient(page, proposalPath());

    const acceptOfferButton = page.locator('.service-proposal__counter-modern-actions .service-proposal__submit');
    await expect(acceptOfferButton).toBeDisabled();
    await expect(acceptOfferButton).toContainText('Verification du devis...');

    await expandMaterialQuotePanel(page);
    await expect(page.getByText('PVC')).toBeVisible();
    await expect(acceptOfferButton).toBeEnabled();
  });

  test('blocks price acceptance while material quote is pending, then finalizes after quote approval', async ({
    page,
  }) => {
    let quoteStatus: MaterialQuoteStatus = 'EN_ATTENTE';
    let acceptCalls = 0;
    let reservationCalls = 0;
    let finalizeCalls = 0;

    await mockCommonServiceProposalRoutes(page);
    await mockClientNegotiationRoutes(page, {
      getQuoteStatus: () => quoteStatus,
      onAccept: () => {
        acceptCalls += 1;
      },
      onCreateReservation: () => {
        reservationCalls += 1;
      },
      onFinalizeQuote: () => {
        finalizeCalls += 1;
      },
      onApproveQuote: () => {
        quoteStatus = 'VALIDE';
      },
    });

    await loginAsClient(page, proposalPath());

    await expect(page.getByText('MATERIEL QUE LE PRESTATAIRE DOIT ACHETER')).toBeVisible();
    await expandMaterialQuotePanel(page);
    await expect(page.getByText('PVC')).toBeVisible();
    await expect(page.getByText('VOUS :')).toBeVisible();
    await expect(page.getByRole('button', { name: /Valider ce materiel/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Refuser ce materiel/i })).toBeVisible();

    const acceptOfferButton = page.locator('.service-proposal__counter-modern-actions .service-proposal__submit');
    await acceptOfferButton.click();
    await expect(page.getByText('Validez ou refusez le devis materiel avant de finaliser la reservation.')).toBeVisible();
    expect(acceptCalls).toBe(0);
    expect(reservationCalls).toBe(0);

    await page.getByRole('button', { name: /Valider ce materiel/i }).click();
    await expect(page.getByText('VALIDE PAR VOUS')).toBeVisible();

    await acceptOfferButton.click();
    await expect(page.getByText(/Vous avez accept(?:e|é) l'offre/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /Payez|Payer|Finaliser|paiement/i })).toBeVisible();

    expect(acceptCalls).toBe(1);
    expect(reservationCalls).toBe(1);
    expect(finalizeCalls).toBe(1);
  });

  test('lets client accept price normally when there is no material quote', async ({ page }) => {
    let acceptCalls = 0;
    let reservationCalls = 0;

    await mockCommonServiceProposalRoutes(page);
    await mockClientNegotiationRoutes(page, {
      getQuoteStatus: () => null,
      onAccept: () => {
        acceptCalls += 1;
      },
      onCreateReservation: () => {
        reservationCalls += 1;
      },
    });

    await loginAsClient(page, proposalPath());

    await expect(page.getByText('MATERIEL QUE LE PRESTATAIRE DOIT ACHETER')).toBeVisible();
    await expandMaterialQuotePanel(page);
    await expect(page.getByText('Aucune fourniture supplementaire')).toBeVisible();
    await page.locator('.service-proposal__counter-modern-actions .service-proposal__submit').click();

    await expect(page.getByText(/Vous avez accept(?:e|é) l'offre/i)).toBeVisible();
    expect(acceptCalls).toBe(1);
    expect(reservationCalls).toBe(1);
  });
});

async function loginAsClient(page: Page, returnUrl: string): Promise<void> {
  await page.addInitScript(
    ({ token, user }) => {
      localStorage.setItem('authStorageMode', 'local');
      localStorage.setItem('accessToken', token);
      localStorage.setItem('currentUser', JSON.stringify(user));
    },
    {
      token: createTestAccessToken('CLIENT'),
      user: {
        id: clientUserId,
        phoneNumber: '+221772345678',
        name: 'Client Jokko',
        role: 'CLIENT',
        avatarUrl: null,
        professionalProfile: null,
      },
    },
  );
  await page.goto(returnUrl);
  await expect(page).toHaveURL(new RegExp(`/services/${professionalId}/proposition`));
}

async function expandMaterialQuotePanel(page: Page): Promise<void> {
  const toggle = page.getByLabel('Afficher ou masquer le devis materiel');
  if ((await toggle.getAttribute('aria-expanded')) !== 'true') {
    await toggle.click();
  }
}

async function mockCommonServiceProposalRoutes(page: Page): Promise<void> {
  await page.route('**/api/v1/auth/me', (route) =>
    fulfillData(route, clientProfile()),
  );
  await page.route('**/api/v1/users/me', (route) => fulfillData(route, clientProfile()));
  await page.route('**/api/v1/notifications?**', (route) => fulfillData(route, []));
  await page.route('**/api/v1/conversations?**', (route) => fulfillData(route, []));
  await page.route(`**/api/v1/professionals/${professionalId}`, (route) =>
    fulfillData(route, {
      id: professionalId,
      utilisateurId: professionalUserId,
      nomEntreprise: 'Nicolas Plomberie',
      ville: 'Dakar',
      noteGlobale: 4.8,
      nombreAvis: 24,
      utilisateur: {
        id: professionalUserId,
        nom: 'Nicolas Plombier',
        numeroTelephone: '+221773456789',
        urlAvatar: null,
        estActif: true,
      },
    }),
  );
  await page.route(`**/api/v1/professionals/${professionalId}/services`, (route) =>
    fulfillData(route, [
      {
        id: serviceId,
        profilProfessionnelId: professionalId,
        nom: 'ROBINET',
        description: 'Pose et remplacement de robinet',
        prix: 5000,
        typePrix: 'NEGOCIABLE',
        modeDeplacement: 'PRESTATAIRE_SE_DEPLACE',
        dureeMinutes: 60,
        estDisponible: true,
      },
    ]),
  );
  await page.route(`**/api/v1/professionals/${professionalId}/portfolio`, (route) => fulfillData(route, []));
  await page.route(`**/api/v1/professionals/${professionalId}/availabilities`, (route) => fulfillData(route, []));
  await page.route(`**/api/v1/professionals/${professionalId}/reviews`, (route) => fulfillData(route, []));
  await page.route(`**/api/v1/professionals/${professionalId}/presence`, (route) =>
    fulfillData(route, {
      professionalId,
      isOnline: true,
      status: 'EN_LIGNE',
      lastLocationLabel: 'Dakar',
      updatedAt: new Date().toISOString(),
    }),
  );
  await page.route('**/api/v1/reservations/availability?**', (route) =>
    fulfillData(route, {
      available: true,
      reason: 'Disponible',
      professionalId,
      dateHeure: scheduledAt,
      dureeMinutes: 60,
      withinAvailability: true,
      hasConflict: false,
    }),
  );
}

function clientProfile() {
  return {
    id: clientUserId,
    numeroTelephone: '+221772345678',
    nom: 'Client Jokko',
    role: 'CLIENT',
    adresse: address,
    urlAvatar: null,
    estActif: true,
    profilProfessionnel: null,
  };
}

async function mockClientNegotiationRoutes(
  page: Page,
  callbacks: {
    getQuoteStatus: () => MaterialQuoteStatus | null;
    onAccept?: () => void;
    onCreateReservation?: () => void;
    onFinalizeQuote?: () => void;
    onApproveQuote?: () => void;
    quoteDelayMs?: number;
  },
): Promise<void> {
  await page.route('**/api/v1/negotiations/my?**', (route) => fulfillData(route, []));
  await page.route(`**/api/v1/negotiations/${negotiationId}`, (route) => {
    if (route.request().method() !== 'GET') {
      return route.fallback();
    }
    return fulfillData(route, negotiation());
  });
  await page.route(`**/api/v1/negotiations/${negotiationId}/accept`, (route) => {
    callbacks.onAccept?.();
    return fulfillData(route, { ...negotiation(), statut: 'ACCEPTEE', montantAccepte: 6500 });
  });
  await page.route(`**/api/v1/negotiations/${negotiationId}/material-quotes`, (route) => {
    const status = callbacks.getQuoteStatus();
    if (callbacks.quoteDelayMs) {
      return new Promise<void>((resolve) => {
        setTimeout(() => {
          fulfillData(route, status ? [materialQuote(status)] : []).then(resolve);
        }, callbacks.quoteDelayMs);
      });
    }
    return fulfillData(route, status ? [materialQuote(status)] : []);
  });
  await page.route(`**/api/v1/negotiations/${negotiationId}/material-quotes/material-quote-1/approve`, (route) => {
    callbacks.onApproveQuote?.();
    return fulfillData(route, materialQuote('VALIDE'));
  });
  await page.route(`**/api/v1/negotiations/${negotiationId}/material-quotes/finalize`, (route) => {
    callbacks.onFinalizeQuote?.();
    return fulfillData(route, { ready: true, quoteCount: 1, pdfUrl: '/api/v1/negotiations/e2e/material-quotes.pdf' });
  });
  await page.route('**/api/v1/reservations/from-negotiation', (route) => {
    callbacks.onCreateReservation?.();
    return fulfillData(route, { id: reservationId }, 201);
  });
}

function negotiation() {
  return {
    id: negotiationId,
    clientId: clientUserId,
    professionnelId: professionalId,
    serviceId,
    statut: 'EN_ATTENTE_CLIENT',
    montantInitial: 5000,
    montantCourant: 6500,
    montantAccepte: null,
    dernierProposePar: 'PRESTATAIRE',
    messageCourant: 'Contre-proposition prestataire.',
    dateHeureProposee: scheduledAt,
    adresseClientProposee: address,
    dureeMinutesProposee: 60,
    reservationId: null,
    creeLe: new Date().toISOString(),
    misAJourLe: new Date().toISOString(),
    propositions: [],
    client: {
      id: clientUserId,
      nom: 'Client Jokko',
      adresse: address,
      urlAvatar: null,
    },
    service: {
      id: serviceId,
      nom: 'ROBINET',
      prix: 5000,
    },
    professionnel: {
      id: professionalId,
      utilisateurId: professionalUserId,
      nomEntreprise: 'Nicolas Plomberie',
      utilisateur: {
        nom: 'Nicolas Plombier',
        urlAvatar: null,
      },
    },
  };
}

function materialQuote(status: MaterialQuoteStatus) {
  return {
    id: 'material-quote-1',
    negotiationId,
    reservationId: null,
    createdByUserId: professionalUserId,
    createdBy: 'PRESTATAIRE',
    designation: 'PVC',
    unitPrice: 8500,
    quantity: 6,
    status,
    clientValidatedAt: status === 'VALIDE' ? new Date().toISOString() : null,
    providerValidatedAt: null,
    rejectedBy: status === 'REFUSE' ? 'CLIENT' : null,
    pdfUrl: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

async function fulfillData(route: Route, data: unknown, status = 200): Promise<void> {
  await route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify({ data }),
  });
}

function createTestAccessToken(role: string): string {
  const payload = Buffer.from(
    JSON.stringify({
      sub: role === 'CLIENT' ? clientUserId : professionalUserId,
      role,
      exp: Math.floor(Date.now() / 1000) + 60 * 60,
    }),
  ).toString('base64url');
  return `e30.${payload}.signature`;
}

function proposalPath(): string {
  return `/services/${professionalId}/proposition?serviceId=${serviceId}&negotiationId=${negotiationId}`;
}
