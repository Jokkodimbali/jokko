import { expect, test, type APIRequestContext, type APIResponse } from '@playwright/test';

const apiBaseURL = process.env['E2E_API_URL'] ?? 'http://localhost:3000/api/v1';

const accounts = {
  client: { identifier: '+221772345678', password: 'client123' },
  provider: { identifier: '+221773456789', password: 'prof12345' },
} as const;

type ApiEnvelope<T> = {
  data: T;
  meta?: unknown;
  message?: string;
};

type ProfessionalProfile = {
  id: string;
};

type ProfessionalService = {
  id: string;
  nom?: string;
  prix?: number;
  price?: number;
  typePrix?: string;
  priceType?: string;
  estDisponible?: boolean;
};

type Negotiation = {
  id: string;
  serviceId: string;
  statut: string;
  montantCourant: number;
  montantAccepte: number | null;
  dateHeureProposee: string | null;
  adresseClientProposee: string | null;
  dureeMinutesProposee: number | null;
};

type Reservation = {
  id: string;
  statut: string;
  prixConvenu: number | null;
  clientRating: number | null;
};

type PaymentInitiation = {
  payment: { id: string; status?: string };
  gatewayReference: string;
  paymentUrl: string;
};

test.describe('Jokko business flow e2e', () => {
  test('client negotiation, provider counter-offer, payment escrow, completion and review stay coherent', async ({
    request,
  }, testInfo) => {
    test.skip(
      testInfo.project.name !== 'edge-desktop',
      'Flux transactionnel execute une seule fois pour eviter les doublons de donnees.',
    );

    const clientToken = await login(request, accounts.client);
    const providerToken = await login(request, accounts.provider);

    const providerProfile = await apiGet<ProfessionalProfile>(
      request,
      '/professionals/me',
      providerToken,
    );
    const providerServices = await apiGet<ProfessionalService[]>(
      request,
      '/professionals/me/services',
      providerToken,
    );
    const service = providerServices.find((item) => {
      const priceType = item.typePrix ?? item.priceType;
      return priceType === 'NEGOCIABLE' && item.estDisponible !== false;
    });

    expect(
      service,
      'Le prestataire seed doit avoir au moins un service negociable disponible.',
    ).toBeTruthy();

    await cancelActiveNegotiationsForService(request, clientToken, service!.id);

    const scheduledAt = buildFutureDate();
    await ensureAvailabilityForDate(request, providerToken, scheduledAt);
    const address = `Test e2e Jokko Plateau ${Date.now()}`;
    const durationMinutes = 60;
    const initialAmount = 5000;
    const counterAmount = initialAmount + 750;

    const createdNegotiation = await apiPost<Negotiation>(request, '/negotiations', clientToken, {
      serviceId: service!.id,
      proposedAmount: initialAmount,
      message: 'Flux e2e automatique: proposition client.',
      dateHeure: scheduledAt,
      adresseClient: address,
      dureeMinutes: durationMinutes,
    });
    expect(createdNegotiation.statut).toBe('EN_ATTENTE_PRESTATAIRE');

    const providerCounter = await apiPatch<Negotiation>(
      request,
      `/negotiations/${createdNegotiation.id}/counter`,
      providerToken,
      {
        proposedAmount: counterAmount,
        message: 'Flux e2e automatique: contre-proposition prestataire.',
        dateHeure: scheduledAt,
        adresseClient: address,
        dureeMinutes: durationMinutes,
      },
    );
    expect(providerCounter.statut).toBe('EN_ATTENTE_CLIENT');
    expect(providerCounter.montantCourant).toBe(counterAmount);

    const acceptedNegotiation = await apiPatch<Negotiation>(
      request,
      `/negotiations/${createdNegotiation.id}/accept`,
      clientToken,
      {},
    );
    expect(acceptedNegotiation.statut).toBe('ACCEPTEE');
    expect(acceptedNegotiation.montantAccepte).toBe(counterAmount);

    const reservation = await apiPost<Reservation>(
      request,
      '/reservations/from-negotiation',
      clientToken,
      {
        negotiationId: createdNegotiation.id,
        dateHeure: scheduledAt,
        adresseClient: address,
        dureeMinutes: durationMinutes,
        notes: 'Reservation creee par le flux e2e.',
      },
    );
    expect(reservation.statut).toBe('EN_ATTENTE');
    expect(reservation.prixConvenu).toBe(counterAmount);

    const payment = await apiPost<PaymentInitiation>(
      request,
      '/payments/initiate',
      clientToken,
      {
        bookingId: reservation.id,
        method: 'WAVE',
        successUrl: 'http://localhost:4200/payment-success',
        cancelUrl: 'http://localhost:4200/payment-cancel',
      },
      { 'idempotency-key': `e2e-${reservation.id}` },
    );
    expect(payment.gatewayReference).toBeTruthy();
    expect(payment.paymentUrl).toBeTruthy();

    const webhook = await apiPost<{ processed: boolean; replay: boolean }>(
      request,
      '/payments/webhook',
      null,
      {
        gatewayReference: payment.gatewayReference,
        status: 'completed',
      },
    );
    expect(webhook.processed).toBe(true);

    const paidReservation = await apiGet<Reservation>(
      request,
      `/reservations/${reservation.id}`,
      clientToken,
    );
    expect(paidReservation.statut).toBe('PAYEE_SEQUESTRE');

    const startedReservation = await apiPatch<Reservation>(
      request,
      `/reservations/${reservation.id}/start`,
      providerToken,
      {},
    );
    expect(startedReservation.statut).toBe('EN_COURS');

    const completedReservation = await apiPatch<Reservation>(
      request,
      `/reservations/${reservation.id}/complete`,
      providerToken,
      {},
    );
    expect(completedReservation.statut).toBe('TERMINEE');

    const reviewedReservation = await apiPatch<Reservation>(
      request,
      `/reservations/${reservation.id}/review`,
      clientToken,
      {
        rating: 5,
        review: 'Flux e2e valide: prestation terminee et avis client depose.',
      },
    );
    expect(reviewedReservation.statut).toBe('TERMINEE');
    expect(reviewedReservation.clientRating).toBe(5);

    expect(providerProfile.id).toBeTruthy();
  });
});

async function login(
  request: APIRequestContext,
  credentials: { identifier: string; password: string },
): Promise<string> {
  const response = await request.post(`${apiBaseURL}/auth/login`, {
    data: credentials,
  });
  await expectOk(response);
  const envelope = (await response.json()) as ApiEnvelope<{ accessToken: string }>;
  expect(envelope.data.accessToken).toBeTruthy();
  return envelope.data.accessToken;
}

async function cancelActiveNegotiationsForService(
  request: APIRequestContext,
  token: string,
  serviceId: string,
): Promise<void> {
  const negotiations = await apiGet<Negotiation[]>(request, '/negotiations/my?scope=CLIENT', token);
  const activeStatuses = new Set(['EN_ATTENTE_PRESTATAIRE', 'EN_ATTENTE_CLIENT']);
  const active = negotiations.filter(
    (negotiation) => negotiation.serviceId === serviceId && activeStatuses.has(negotiation.statut),
  );

  for (const negotiation of active) {
    await apiPatch<Negotiation>(request, `/negotiations/${negotiation.id}/cancel`, token, {
      reason: 'Nettoyage avant flux e2e automatique.',
    });
  }
}

async function ensureAvailabilityForDate(
  request: APIRequestContext,
  token: string,
  scheduledAtIso: string,
): Promise<void> {
  const scheduledAt = new Date(scheduledAtIso);
  const response = await request.post(`${apiBaseURL}/professionals/me/availabilities`, {
    data: {
      dayOfWeek: scheduledAt.getDay(),
      startTime: '09:00',
      endTime: '18:00',
    },
    headers: authHeaders(token),
  });

  if (response.ok()) {
    return;
  }

  const body = await response.text();
  if (
    response.status() === 409 ||
    body.includes('ALREADY') ||
    body.includes('existe') ||
    body.includes('chevauche')
  ) {
    return;
  }

  throw new Error(`${response.status()} ${response.url()}: ${body}`);
}

async function apiGet<T>(request: APIRequestContext, path: string, token: string): Promise<T> {
  const response = await request.get(`${apiBaseURL}${path}`, {
    headers: authHeaders(token),
  });
  await expectOk(response);
  return unwrap<T>(response);
}

async function apiPost<T>(
  request: APIRequestContext,
  path: string,
  token: string | null,
  data: unknown,
  headers: Record<string, string> = {},
): Promise<T> {
  const response = await request.post(`${apiBaseURL}${path}`, {
    data,
    headers: token ? { ...authHeaders(token), ...headers } : headers,
  });
  await expectOk(response);
  return unwrap<T>(response);
}

async function apiPatch<T>(
  request: APIRequestContext,
  path: string,
  token: string,
  data: unknown,
): Promise<T> {
  const response = await request.patch(`${apiBaseURL}${path}`, {
    data,
    headers: authHeaders(token),
  });
  await expectOk(response);
  return unwrap<T>(response);
}

function authHeaders(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}` };
}

async function unwrap<T>(response: APIResponse): Promise<T> {
  const envelope = (await response.json()) as ApiEnvelope<T>;
  return envelope.data;
}

async function expectOk(response: APIResponse): Promise<void> {
  if (!response.ok()) {
    throw new Error(`${response.status()} ${response.url()}: ${await response.text()}`);
  }
}

function buildFutureDate(): string {
  const date = new Date();
  date.setDate(date.getDate() + 14);
  date.setHours(10, 30, 0, 0);
  return date.toISOString();
}
