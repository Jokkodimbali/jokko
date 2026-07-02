import { expect, test, type APIRequestContext, type Page } from '@playwright/test';

const apiUrl = process.env['E2E_API_URL'] ?? 'http://localhost:3000/api/v1';
const reservationId = 'dd69229c-cb80-4000-93fd-3efe304b42e1';

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

  test('future paid appointment waits silently until service day', async ({
    page,
    request,
  }) => {
    await openState(page, request, 'PAYEE_SEQUESTRE', 'INACTIF', undefined, {
      scheduled: 'future',
    });
    await expect(page.locator('.jokko-tracking-taxi-marker')).toHaveCount(0);
    await expect(page.locator('.appointment-detail__navigation-guidance')).toHaveCount(0);
    await expectNoSpeech(page);
  });

  test('paid appointment on service day opens the operational map before route starts', async ({
    page,
    request,
  }) => {
    await openState(page, request, 'PAYEE_SEQUESTRE', 'INACTIF', 'PRESTATAIRE');
    await expect(page.locator('.appointment-detail__upcoming')).toHaveCount(0);
    await expect(page.locator('.appointment-detail__google-map')).toBeVisible();
    await expect(page.getByRole('button', { name: /^En route$/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Commencer$/i })).toBeDisabled();
    await expect(page.getByRole('button', { name: /^Terminer$/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Terminer$/i })).toBeDisabled();
  });

  test('client-travels service day blocks provider start until client is on the way and arrived', async ({
    page,
    request,
  }) => {
    await openState(page, request, 'PAYEE_SEQUESTRE', 'INACTIF', 'PRESTATAIRE', {
      travelMode: 'CLIENT_SE_DEPLACE',
    });
    await expect(page.locator('.appointment-detail__google-map')).toBeVisible();
    await expect(page.getByRole('button', { name: /^En route$/i })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /^Commencer$/i })).toBeDisabled();
    await expect(page.getByRole('button', { name: /^Terminer$/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Terminer$/i })).toBeDisabled();
  });

  test('client-travels service day lets client share the route', async ({ page, request }) => {
    await openState(page, request, 'PAYEE_SEQUESTRE', 'INACTIF', undefined, {
      travelMode: 'CLIENT_SE_DEPLACE',
    });
    await expect(page.locator('.appointment-detail__tracking-steps')).toBeVisible();
    await expect(page.getByText(/Intervention confirmee/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /^En route$/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Commencer$/i })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /^Terminer$/i })).toHaveCount(0);
  });

  test('client-travels client can start route with a valid Dakar GPS position', async ({
    page,
    request,
  }) => {
    await openState(page, request, 'PAYEE_SEQUESTRE', 'INACTIF', undefined, {
      travelMode: 'CLIENT_SE_DEPLACE',
      browserGeolocation: { latitude: 14.7405004, longitude: -17.4749579 },
    });

    await page.getByRole('button', { name: /^En route$/i }).click();

    await expect(page.locator('.appointment-detail__google-map')).toBeVisible();
    await expect(page.locator('.appointment-detail__navigation-guidance')).toBeVisible();
    await expect(page.getByRole('button', { name: /^Position$/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Commencer$/i })).toHaveCount(0);
  });

  test('client-travels client can start route when browser GPS is outside Senegal by using departure address', async ({
    page,
    request,
  }) => {
    await openState(page, request, 'PAYEE_SEQUESTRE', 'INACTIF', undefined, {
      travelMode: 'CLIENT_SE_DEPLACE',
      browserGeolocation: { latitude: 48.8566, longitude: 2.3522 },
    });

    await page.getByRole('button', { name: /^En route$/i }).click();

    await expect(page.locator('.appointment-detail__google-map')).toBeVisible();
    await expect(page.locator('.appointment-detail__navigation-guidance')).toBeVisible();
    await expect(
      page.getByText(/position detectee est hors du Senegal/i),
    ).toHaveCount(0);
  });

  test('client-travels route is visible to provider once client is on the way', async ({
    page,
    request,
  }) => {
    await openState(page, request, 'PAYEE_SEQUESTRE', 'EN_ROUTE', 'PRESTATAIRE', {
      travelMode: 'CLIENT_SE_DEPLACE',
    });
    await expect(page.locator('.appointment-detail__google-map')).toBeVisible();
    await expect(page.locator('.appointment-detail__navigation-guidance')).toBeVisible();
    await expect(page.getByText(/Client Tracking en route/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /^En route$/i })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /^Commencer$/i })).toBeDisabled();
    await expect(page.getByRole('button', { name: /^Terminer$/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Terminer$/i })).toBeDisabled();
  });

  test('provider can start only when the client-travels route has arrived', async ({
    page,
    request,
  }) => {
    await openState(page, request, 'PAYEE_SEQUESTRE', 'EN_ROUTE', 'PRESTATAIRE', {
      travelMode: 'CLIENT_SE_DEPLACE',
      routeDistanceMeters: 80,
    });
    await expect(page.locator('.appointment-detail__google-map')).toBeVisible();
    await expect(page.getByRole('button', { name: /^Commencer$/i })).toBeEnabled();
  });

  test('provider on the way has route, taxi and navigation', async ({ page, request }) => {
    await openState(page, request, 'PAYEE_SEQUESTRE', 'EN_ROUTE', 'PRESTATAIRE');
    await expect(page.locator('.appointment-detail__google-map')).toBeVisible();
    await expect(page.locator('.appointment-detail__navigation-guidance')).toBeVisible();
    await expect(page.locator('.appointment-detail__map-top-actions')).toBeVisible();
    await expect(page.getByRole('button', { name: /Satellite/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Rotation/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Commencer$/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Terminer$/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Terminer$/i })).toBeDisabled();
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

  test('provider arrived can see the finish action', async ({ page, request }) => {
    await openState(page, request, 'EN_COURS', 'EN_PRESTATION', 'PRESTATAIRE');
    await expect(page.getByText(/Prestation en cours/i).first()).toBeVisible();
    await expect(page.getByRole('button', { name: /^Terminer$/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Terminer$/i })).toBeEnabled();
  });

  test('completed service stops map, taxi and speech', async ({ page, request }) => {
    await openState(page, request, 'TERMINEE', 'TERMINEE');
    await expect(page.getByText(/Mission accomplie/i)).toBeVisible();
    await expect(page.locator('.appointment-detail__tracking-steps')).toBeVisible();
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
  options: {
    scheduled?: 'today' | 'future';
    travelMode?: 'PRESTATAIRE_SE_DEPLACE' | 'CLIENT_SE_DEPLACE';
    browserGeolocation?: { latitude: number; longitude: number };
    routeDistanceMeters?: number;
  } = {},
): Promise<void> {
  let login: { data: { accessToken: string; user: Record<string, unknown> } } = {
    data: {
      accessToken: 'e2e-token',
      user: {
        id: 'client-fixture',
        role: 'CLIENT',
        nom: 'Client Tracking',
        numeroTelephone: '+221770000000',
      },
    },
  };

  try {
    const loginResponse = await request.post(`${apiUrl}/auth/login`, {
      data: { identifier: '+221772345678', password: 'client123' },
      timeout: 3_000,
    });
    if (loginResponse.ok()) {
      login = (await loginResponse.json()) as {
        data: { accessToken: string; user: Record<string, unknown> };
      };
    }
  } catch {
    // The tracking UI tests can run without a local backend.
  }

  const headers = { Authorization: `Bearer ${login.data.accessToken}` };
  let reservation = { data: fallbackReservationData() };
  let tracking: {
    data: Record<string, unknown> & { presence: Record<string, unknown> };
  } = { data: fallbackTrackingData() };

  try {
    const [reservationResponse, trackingResponse] = await Promise.all([
      request.get(`${apiUrl}/reservations/${reservationId}`, { headers, timeout: 3_000 }),
      request.get(`${apiUrl}/reservations/${reservationId}/live-tracking`, {
        headers,
        timeout: 3_000,
      }),
    ]);

    if (reservationResponse.ok()) {
      reservation = (await reservationResponse.json()) as {
        data: Record<string, unknown>;
      };
    }
    if (trackingResponse.ok()) {
      tracking = (await trackingResponse.json()) as {
        data: Record<string, unknown> & { presence: Record<string, unknown> };
      };
    }
  } catch {
    // Keep local fixtures when the backend is not reachable.
  }
  const todayDate = new Date(Date.now() - 15 * 60 * 1000).toISOString();
  const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const appointmentData = {
    ...reservation.data,
    statut: reservationState,
    dateHeure:
      reservationState === 'CONFIRMEE' || options.scheduled === 'future'
        ? futureDate
        : todayDate,
    service: {
      ...(reservation.data['service'] as Record<string, unknown> | undefined),
      modeDeplacement:
        options.travelMode ??
        ((reservation.data['service'] as Record<string, unknown> | undefined)?.['modeDeplacement'] ??
          'PRESTATAIRE_SE_DEPLACE'),
    },
  };
  let trackingData = {
    ...tracking.data,
    trackingStatus: trackingState,
    lastLatitude: 14.7405004,
    lastLongitude: -17.4749579,
    route: trackingState === 'EN_ROUTE' ? fallbackRoute(options.routeDistanceMeters) : null,
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
    ({ accessToken, user, browserGeolocation }) => {
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
      if (browserGeolocation) {
        Object.defineProperty(navigator, 'geolocation', {
          configurable: true,
          value: {
            getCurrentPosition(success: PositionCallback): void {
              success({
                coords: {
                  latitude: browserGeolocation.latitude,
                  longitude: browserGeolocation.longitude,
                  accuracy: 12,
                  altitude: null,
                  altitudeAccuracy: null,
                  heading: 90,
                  speed: 5,
                },
                timestamp: Date.now(),
              } as GeolocationPosition);
            },
            watchPosition(success: PositionCallback): number {
              success({
                coords: {
                  latitude: browserGeolocation.latitude,
                  longitude: browserGeolocation.longitude,
                  accuracy: 12,
                  altitude: null,
                  altitudeAccuracy: null,
                  heading: 90,
                  speed: 5,
                },
                timestamp: Date.now(),
              } as GeolocationPosition);
              return 1;
            },
            clearWatch(): void {},
          },
        });
      }
    },
    {
      accessToken: login.data.accessToken,
      user: browserUser,
      browserGeolocation: options.browserGeolocation,
    },
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
  await page.route(`**/api/v1/reservations/${reservationId}/on-the-way`, async (route) => {
    const payload = route.request().postDataJSON() as {
      latitude?: number;
      longitude?: number;
      accuracyMeters?: number | null;
      headingDegrees?: number | null;
      speedKmh?: number | null;
      locationLabel?: string | null;
    };
    trackingData = {
      ...trackingData,
      trackingStatus: 'EN_ROUTE',
      lastLatitude: payload.latitude ?? 14.7405004,
      lastLongitude: payload.longitude ?? -17.4749579,
      lastAccuracyMeters: payload.accuracyMeters ?? null,
      lastHeadingDegrees: payload.headingDegrees ?? null,
      lastSpeedKmh: payload.speedKmh ?? null,
      lastLocationLabel: payload.locationLabel ?? 'Position GPS du client',
      route: fallbackRoute(options.routeDistanceMeters),
    };
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data: trackingData }),
    });
  });
  await page.route(
    `**/api/v1/reservations/${reservationId}/live-tracking/location`,
    (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: trackingData }),
      }),
  );
  await page.route('**/api/v1/maps/geocode**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: { latitude: 14.7405004, longitude: -17.4749579 },
      }),
    }),
  );
  await page.route('**/api/v1/maps/routes', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: [
          {
            distanceMeters: options.routeDistanceMeters ?? 7400,
            durationSeconds: options.routeDistanceMeters && options.routeDistanceMeters <= 120 ? 20 : 900,
            encodedPolyline: '',
            coordinates: fallbackRoute(options.routeDistanceMeters).coordinates,
            navigationSteps: fallbackRoute(options.routeDistanceMeters).navigationSteps,
          },
        ],
      }),
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

function fallbackRoute(distanceMeters = 7400): Record<string, unknown> {
  const arrived = distanceMeters <= 120;
  const durationSeconds = arrived ? 20 : 900;
  const destination = arrived
    ? { latitude: 14.74055, longitude: -17.47491 }
    : { latitude: 14.74584, longitude: -17.40015 };
  return {
    distanceRemainingMeters: distanceMeters,
    durationRemainingSeconds: durationSeconds,
    estimatedArrivalAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
    encodedPolyline: '',
    coordinates: [
      { latitude: 14.7405004, longitude: -17.4749579 },
      destination,
    ],
    navigationSteps: [
      {
        id: 'step-1',
        instruction: 'Continuez vers la destination',
        maneuver: null,
        distanceMeters,
        durationSeconds,
        start: { latitude: 14.7405004, longitude: -17.4749579 },
        end: destination,
      },
    ],
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
    route: fallbackRoute(),
  };
}
