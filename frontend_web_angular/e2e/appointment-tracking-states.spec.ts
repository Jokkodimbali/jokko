import { expect, test, type APIRequestContext, type Page } from '@playwright/test';

const apiUrl = process.env['E2E_API_URL'] ?? 'http://localhost:3000/api/v1';
const reservationId = 'dd69229c-cb80-4000-93fd-3efe304b42e1';
const destination = { latitude: 14.74584, longitude: -17.40015 };

type ReservationState =
  | 'EN_ATTENTE'
  | 'CONFIRMEE'
  | 'PAYEE_SEQUESTRE'
  | 'EN_COURS'
  | 'TERMINEE'
  | 'ANNULEE'
  | 'NO_SHOW'
  | 'LITIGE';

test.describe('Appointment tracking lifecycle', () => {
  test.describe.configure({ timeout: 60_000 });

  test('confirmed appointment has no active navigation', async ({ page, request }) => {
    await openState(page, request, 'CONFIRMEE', 'INACTIF');
    await expect(page.locator('.jokko-tracking-taxi-marker')).toHaveCount(0);
    await expect(page.locator('.appointment-detail__navigation-guidance')).toHaveCount(0);
    await expectNoSpeech(page);
  });

  test('pending appointment has no active navigation', async ({ page, request }) => {
    await openState(page, request, 'EN_ATTENTE', 'INACTIF');
    await expect(page.locator('.jokko-tracking-taxi-marker')).toHaveCount(0);
    await expect(page.locator('.appointment-detail__navigation-guidance')).toHaveCount(0);
    await expectNoSpeech(page);
  });

  test('paid appointment waits silently until provider starts route', async ({
    page,
    request,
  }) => {
    await openState(page, request, 'PAYEE_SEQUESTRE', 'INACTIF');
    await expect(page.locator('.jokko-tracking-taxi-marker')).toHaveCount(0);
    await expect(page.locator('.appointment-detail__navigation-guidance')).toHaveCount(0);
    await expectNoSpeech(page);
  });

  test('provider on the way has route, taxi and navigation', async ({ page, request }) => {
    await openState(page, request, 'PAYEE_SEQUESTRE', 'EN_ROUTE');
    await expect(page.locator('.appointment-detail__google-map')).toBeVisible();
    await expect(page.locator('.appointment-detail__navigation-guidance')).toBeVisible();
    await expect(page.locator('.appointment-detail__map-top-actions')).toBeVisible();
    await expect(page.getByRole('button', { name: /Satellite/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Rotation/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /Google Maps/i })).toBeVisible();
    await expect(page.locator('.appointment-detail__map-direction-pad')).toBeVisible();

    const topActions = page.locator('.appointment-detail__map-top-actions');
    const directionPad = page.locator('.appointment-detail__map-direction-pad');
    const satelliteBox = await page.getByRole('button', { name: /Satellite/i }).boundingBox();
    const rotationBox = await page.getByRole('button', { name: /Rotation/i }).boundingBox();
    const googleMapsBox = await page.getByRole('link', { name: /Google Maps/i }).boundingBox();
    expect(satelliteBox).not.toBeNull();
    expect(rotationBox).not.toBeNull();
    expect(googleMapsBox).not.toBeNull();
    expect(Math.abs((satelliteBox?.y ?? 0) - (rotationBox?.y ?? 0))).toBeLessThan(6);
    expect(Math.abs((rotationBox?.y ?? 0) - (googleMapsBox?.y ?? 0))).toBeLessThan(6);

    await page.getByRole('button', { name: /Rotation/i }).click();
    await expect(topActions).toContainText('45°');
    await page.getByRole('button', { name: /^Nord$/i }).click();
    await expect(topActions).toContainText('0°');
    await page.getByRole('button', { name: /vers l'est/i }).click();
    await expect(directionPad).toContainText('90°');
    await page.getByRole('button', { name: /sud/i }).click();
    await expect(directionPad).toContainText('180°');
    await page.getByRole('button', { name: /vers le nord/i }).click();
    await expect(directionPad).toContainText('0°');
  });

  test('provider arrived has taxi at destination', async ({ page, request }) => {
    await openState(page, request, 'EN_COURS', 'EN_PRESTATION');
    const taxi = page.locator('.jokko-tracking-taxi-marker');
    await expect(taxi).toHaveAttribute('data-latitude', String(destination.latitude), {
      timeout: 20_000,
    });
    await expect(taxi).toHaveAttribute('data-longitude', String(destination.longitude));
    await expect(taxi).toContainText(/Arrive a destination/i);
  });

  test('completed service stops map, taxi and speech', async ({ page, request }) => {
    await openState(page, request, 'TERMINEE', 'TERMINEE');
    await expect(page.getByText(/Mission validee/i)).toBeVisible();
    await expect(page.locator('.appointment-detail__google-map')).toHaveCount(0);
    await expect(page.locator('.jokko-tracking-taxi-marker')).toHaveCount(0);
    await expect(page.locator('.appointment-detail__navigation-guidance')).toHaveCount(0);
    await expectNoSpeech(page);
  });

  for (const state of ['ANNULEE', 'NO_SHOW', 'LITIGE'] as const) {
    test(`${state} closes all live navigation`, async ({ page, request }) => {
      await openState(
        page,
        request,
        state,
        'ANNULEE',
        state === 'LITIGE' ? 'PRESTATAIRE' : undefined,
      );
      await expect(page.locator('.appointment-detail__closed')).toBeVisible();
      await expect(page.locator('.appointment-detail__provider-controls')).toHaveCount(0);
      await expect(page.locator('.appointment-detail__google-map')).toHaveCount(0);
      await expect(page.locator('.jokko-tracking-taxi-marker')).toHaveCount(0);
      await expect(page.locator('.appointment-detail__navigation-guidance')).toHaveCount(0);
      await expect(page.getByRole('button', { name: /Je suis en route/i })).toHaveCount(0);
      await expect(page.getByRole('button', { name: /Ajuster le prix/i })).toHaveCount(0);
      if (state === 'LITIGE') {
        await expect(
          page.getByRole('button', { name: /Consulter le suivi du litige/i }),
        ).toBeVisible();
        await expect(page.getByText(/actions de prestation sont bloquees/i)).toBeVisible();
      }
      await expectNoSpeech(page);
    });
  }
});

async function openState(
  page: Page,
  request: APIRequestContext,
  reservationState: ReservationState,
  trackingState: string,
  viewerRole?: 'PRESTATAIRE',
): Promise<void> {
  const loginResponse = await request.post(`${apiUrl}/auth/login`, {
    data: { identifier: '+221772345678', password: 'client123' },
  });
  expect(loginResponse.ok(), await loginResponse.text()).toBe(true);
  const login = (await loginResponse.json()) as {
    data: { accessToken: string; user: Record<string, unknown> };
  };
  const headers = { Authorization: `Bearer ${login.data.accessToken}` };
  const [reservationResponse, trackingResponse] = await Promise.all([
    request.get(`${apiUrl}/reservations/${reservationId}`, { headers }),
    request.get(`${apiUrl}/reservations/${reservationId}/live-tracking`, { headers }),
  ]);

  const reservation = reservationResponse.ok()
    ? ((await reservationResponse.json()) as { data: Record<string, unknown> })
    : { data: fallbackReservationData() };
  const tracking = trackingResponse.ok()
    ? ((await trackingResponse.json()) as {
        data: Record<string, unknown> & { presence: Record<string, unknown> };
      })
    : { data: fallbackTrackingData() };
  const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const appointmentData = {
    ...reservation.data,
    statut: reservationState,
    dateHeure: reservationState === 'CONFIRMEE' ? futureDate : reservation.data['dateHeure'],
  };
  const trackingData = {
    ...tracking.data,
    trackingStatus: trackingState,
    lastLatitude: 14.7405004,
    lastLongitude: -17.4749579,
    presence: {
      ...tracking.data.presence,
      status: trackingState,
      lastLatitude: 14.7405004,
      lastLongitude: -17.4749579,
    },
  };

  const browserUser = viewerRole
    ? { ...login.data.user, role: viewerRole }
    : login.data.user;
  await page.addInitScript(
    ({ accessToken, user }) => {
      localStorage.setItem('accessToken', accessToken);
      localStorage.setItem('currentUser', JSON.stringify(user));
      localStorage.setItem('authStorageMode', 'local');
      const spoken: string[] = [];
      Object.defineProperty(window, '__jokkoSpokenInstructions', {
        configurable: true,
        value: spoken,
      });
      window.speechSynthesis.speak = (utterance: SpeechSynthesisUtterance) => {
        spoken.push(utterance.text);
      };
    },
    { accessToken: login.data.accessToken, user: browserUser },
  );
  await page.routeWebSocket('**/socket.io/**', (webSocket) =>
    webSocket.close(),
  );
  await page.route('**/socket.io/**', (route) => route.abort());
  await page.route(`**/api/v1/reservations/${reservationId}`, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: appointmentData }),
    }),
  );
  await page.route(
    `**/api/v1/reservations/${reservationId}/live-tracking`,
    (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: trackingData }),
      }),
  );

  await page.goto(`/appointments/${reservationId}`);
  await expect(page.locator('app-appointment-detail-loading')).toBeHidden({
    timeout: 15_000,
  });
}

async function expectNoSpeech(page: Page): Promise<void> {
  await page.waitForTimeout(800);
  const spoken = await page.evaluate(
    () =>
      (
        window as typeof window & {
          __jokkoSpokenInstructions?: string[];
        }
      ).__jokkoSpokenInstructions ?? [],
  );
  expect(spoken).toEqual([]);
}

function fallbackReservationData(): Record<string, unknown> {
  const now = new Date(Date.now() - 15 * 60 * 1000).toISOString();
  return {
    id: reservationId,
    clientId: 'client-fixture',
    professionnelId: 'professional-fixture',
    serviceId: 'service-fixture',
    dateHeure: now,
    adresseClient: 'Plateau, Dakar',
    dureeMinutes: 45,
    statut: 'PAYEE_SEQUESTRE',
    notes: 'Fixture E2E tracking',
    prixConvenu: 15000,
    statutAjustementPrix: 'AUCUN',
    prixAjustementPropose: null,
    raisonAjustementPrix: null,
    demandeAjustementPrixLe: null,
    clientRating: null,
    clientReview: null,
    clientReviewedAt: null,
    raisonAnnulation: null,
    creeLe: now,
    misAJourLe: now,
    client: {
      id: 'client-fixture',
      nom: 'Client Tracking',
      numeroTelephone: '+221770000000',
      email: 'client@example.com',
      adresse: 'Plateau, Dakar',
      urlAvatar: null,
    },
    service: {
      id: 'service-fixture',
      profilProfessionnelId: 'professional-fixture',
      categorieId: 'category-fixture',
      nom: 'Consultation a domicile',
      description: 'Service fixture pour verifier la carte.',
      prix: 15000,
      typePrix: 'FIXE',
      modeDeplacement: 'PRESTATAIRE_SE_DEPLACE',
      dureeMinutes: 45,
      estObligatoire: true,
      estDisponible: true,
      categorie: {
        id: 'category-fixture',
        nom: 'Sante',
        urlIcone: null,
        tauxCommission: 10,
      },
    },
    professionnel: {
      id: 'professional-fixture',
      utilisateurId: 'professional-user-fixture',
      nomEntreprise: 'Dr Tracking',
      ville: 'Dakar',
      noteGlobale: 4.8,
      nombreAvis: 24,
      utilisateur: {
        id: 'professional-user-fixture',
        nom: 'Dr Tracking',
        numeroTelephone: '+221771111111',
        urlAvatar: null,
      },
    },
  };
}

function fallbackTrackingData(): Record<string, unknown> & {
  presence: Record<string, unknown>;
} {
  const now = new Date().toISOString();
  return {
    reservationId,
    clientUserId: 'client-fixture',
    professionalId: 'professional-fixture',
    professionalUserId: 'professional-user-fixture',
    trackingStatus: 'EN_ROUTE',
    startedAt: now,
    endedAt: null,
    lastLatitude: 14.7405004,
    lastLongitude: -17.4749579,
    lastAccuracyMeters: 8,
    lastHeadingDegrees: 90,
    lastSpeedKmh: 22,
    lastLocationLabel: 'Position GPS du prestataire',
    lastPositionAt: now,
    updatedAt: now,
    presence: {
      professionalId: 'professional-fixture',
      isOnline: true,
      status: 'EN_ROUTE',
      lastLatitude: 14.7405004,
      lastLongitude: -17.4749579,
      lastAccuracyMeters: 8,
      lastHeadingDegrees: 90,
      lastSpeedKmh: 22,
      lastLocationLabel: 'Position GPS du prestataire',
      lastPositionAt: now,
      lastSeenAt: now,
      updatedAt: now,
    },
    route: {
      distanceRemainingMeters: 7400,
      durationRemainingSeconds: 900,
      estimatedArrivalAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
      encodedPolyline: '',
      coordinates: [
        { latitude: 14.7405004, longitude: -17.4749579 },
        { latitude: 14.74584, longitude: -17.40015 },
      ],
      navigationSteps: [
        {
          id: 'step-1',
          instruction: 'Continuez vers la destination',
          maneuver: null,
          distanceMeters: 7400,
          durationSeconds: 900,
          start: { latitude: 14.7405004, longitude: -17.4749579 },
          end: { latitude: 14.74584, longitude: -17.40015 },
        },
      ],
    },
  };
}
