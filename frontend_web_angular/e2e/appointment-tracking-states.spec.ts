import { expect, test, type APIRequestContext, type Page } from '@playwright/test';

const apiUrl = process.env['E2E_API_URL'] ?? 'http://localhost:3000/api/v1';
const reservationId = 'dd69229c-cb80-4000-93fd-3efe304b42e1';
const clientFixtureId = '00000000-0000-4000-8000-000000000101';
const professionalFixtureId = '00000000-0000-4000-8000-000000000202';
const professionalUserFixtureId = '00000000-0000-4000-8000-000000000203';
const serviceFixtureId = '00000000-0000-4000-8000-000000000303';
const categoryFixtureId = '00000000-0000-4000-8000-000000000404';

type ReservationState =
  | 'EN_ATTENTE'
  | 'CONFIRMEE'
  | 'PAYEE_SEQUESTRE'
  | 'EN_COURS'
  | 'TERMINEE'
  | 'ANNULEE'
  | 'NO_SHOW'
  | 'LITIGE';

type RouteRequestRecord = {
  origin: { latitude: number; longitude: number };
  destination: { latitude: number; longitude: number };
};

type TrackingTestHarness = {
  routeRequests: RouteRequestRecord[];
  locationUpdates: Array<{
    latitude?: number;
    longitude?: number;
    headingDegrees?: number | null;
  }>;
  markTravelerArrivedOnServer: () => void;
};

type MapDebugState = {
  centers: Array<{ lat: number; lng: number }>;
  cameras: Array<{
    center?: { lat: number; lng: number };
    zoom?: number;
    heading?: number;
    tilt?: number;
  }>;
  headings: number[];
  markerPositions: Array<{ lat: number; lng: number }>;
  providerMarkerPositions: Array<{ lat: number; lng: number }>;
};

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

  test('paid appointment on service day opens the provider console before route starts', async ({
    page,
    request,
  }) => {
    await openState(page, request, 'PAYEE_SEQUESTRE', 'INACTIF', 'PRESTATAIRE');
    await expect(page.locator('.appointment-detail__upcoming')).toHaveCount(0);
    await expect(page.locator('.appointment-detail__provider-console-visual')).toBeVisible();
    await expect(page.locator('.appointment-detail__google-map')).toHaveCount(0);
    await expect(page.getByRole('button', { name: /Demarrer le trajet/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Commencer$/i })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /^Terminer$/i })).toHaveCount(0);
  });

  test('client-travels service day blocks provider start until client is on the way and arrived', async ({
    page,
    request,
  }) => {
    await openState(page, request, 'PAYEE_SEQUESTRE', 'INACTIF', 'PRESTATAIRE', {
      travelMode: 'CLIENT_SE_DEPLACE',
    });
    await expect(page.locator('.appointment-detail__provider-console-visual')).toBeVisible();
    await expect(page.locator('.appointment-detail__google-map')).toHaveCount(0);
    await expect(page.getByRole('button', { name: /^En route$/i })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /En attente du client/i })).toBeDisabled();
    await expect(page.getByRole('button', { name: /^Commencer$/i })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /^Terminer$/i })).toHaveCount(0);
  });

  test('client-travels service day lets client share the route', async ({ page, request }) => {
    await openState(page, request, 'PAYEE_SEQUESTRE', 'INACTIF', undefined, {
      travelMode: 'CLIENT_SE_DEPLACE',
    });
    await expect(page.locator('.appointment-tracking-stepper')).toBeVisible();
    await expect(page.getByText(/Intervention confirmee/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /^Partager ma position$/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Commencer$/i })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /^Terminer$/i })).toHaveCount(0);
  });

  test('client-travels client can start route with a valid Dakar GPS position', async ({
    page,
    request,
  }) => {
    const destination = { latitude: 14.74584, longitude: -17.40015 };
    await openState(page, request, 'PAYEE_SEQUESTRE', 'INACTIF', undefined, {
      travelMode: 'CLIENT_SE_DEPLACE',
      browserGeolocation: { latitude: 14.7405004, longitude: -17.4749579 },
    });

    await page.getByRole('button', { name: /^Partager ma position$/i }).click();

    await expect(page.locator('.appointment-detail__google-map')).toBeVisible();
    await expect(page.locator('.appointment-detail__navigation-guidance')).toBeVisible();
    await expect(page.getByRole('button', { name: /Je suis arriv/i })).toBeEnabled();
    await expect(page.getByRole('button', { name: /^Commencer$/i })).toHaveCount(0);

    await page.getByRole('button', { name: /Je suis arriv/i }).click();
    await page.waitForFunction((position) => {
      const debug = (window as typeof window & { __jokkoMapDebug?: MapDebugState }).__jokkoMapDebug;
      const marker = debug?.providerMarkerPositions.at(-1);
      return !!marker &&
        Math.abs(marker.lat - position.latitude) < 0.00001 &&
        Math.abs(marker.lng - position.longitude) < 0.00001;
    }, destination);
  });

  test('client-travels client can start route when browser GPS is outside Senegal by using departure address', async ({
    page,
    request,
  }) => {
    await openState(page, request, 'PAYEE_SEQUESTRE', 'INACTIF', undefined, {
      travelMode: 'CLIENT_SE_DEPLACE',
      browserGeolocation: { latitude: 48.8566, longitude: 2.3522 },
    });

    await page.getByRole('button', { name: /^Partager ma position$/i }).click();

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
    await expect(page.getByRole('button', { name: /^En route$/i })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /^Arriv/i })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /^Commencer$/i })).toBeDisabled();
    await expect(page.getByRole('button', { name: /^Terminer$/i })).toHaveCount(0);
  });

  test('provider can start once the client has arrived', async ({
    page,
    request,
  }) => {
    await openState(page, request, 'PAYEE_SEQUESTRE', 'EN_ROUTE', 'PRESTATAIRE', {
      travelMode: 'CLIENT_SE_DEPLACE',
      routeDistanceMeters: 80,
    });
    await expect(page.locator('.appointment-detail__google-map')).toBeVisible();
    await expect(page.getByRole('button', { name: /^Arriv/i })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /^Commencer$/i })).toBeEnabled();
  });

  test('provider can start after client arrival even when route refresh is unavailable', async ({
    page,
    request,
  }) => {
    await openState(page, request, 'PAYEE_SEQUESTRE', 'EN_ROUTE', 'PRESTATAIRE', {
      travelMode: 'CLIENT_SE_DEPLACE',
      arrivedLocationWithoutRoute: true,
    });
    await expect(page.locator('.appointment-detail__google-map')).toBeVisible();
    await expect(page.getByText(/Carte indisponible/i)).toHaveCount(0);
    await expect(page.getByRole('button', { name: /^Commencer$/i })).toBeEnabled();
  });

  test('provider can start when client arrival tracking is no longer marked en route', async ({
    page,
    request,
  }) => {
    await openState(page, request, 'PAYEE_SEQUESTRE', 'TERMINEE', 'PRESTATAIRE', {
      travelMode: 'CLIENT_SE_DEPLACE',
      arrivedLocationWithoutRoute: true,
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
    await expect(page.getByRole('button', { name: /^Arrivé$/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Terminer$/i })).toHaveCount(0);
    await expect(page.getByRole('link', { name: /Google Maps/i })).toBeVisible();
    await expect(page.locator('.appointment-detail__map-direction-pad')).toBeVisible();

    const directionPad = page.locator('.appointment-detail__map-direction-pad');
    const satelliteBox = await page.getByRole('button', { name: /Satellite/i }).boundingBox();
    const googleMapsBox = await page.getByRole('link', { name: /Google Maps/i }).boundingBox();
    expect(satelliteBox).not.toBeNull();
    expect(googleMapsBox).not.toBeNull();
    expect(Math.abs((satelliteBox?.y ?? 0) - (googleMapsBox?.y ?? 0))).toBeLessThan(6);

    await page.getByRole('button', { name: /vers l'est/i }).click();
    await expect(directionPad).toContainText('90°');
    await page.getByRole('button', { name: /sud/i }).click();
    await expect(directionPad).toContainText('180°');
    await page.getByRole('button', { name: /vers le nord/i }).click();
    await expect(directionPad).toContainText('0°');
  });

  test('provider route follows real off-course GPS position and recenters the camera', async ({
    page,
    request,
  }) => {
    const initialPosition = { latitude: 14.7405004, longitude: -17.4749579 };
    const offCoursePosition = { latitude: 14.74235, longitude: -17.4708 };
    const { routeRequests, locationUpdates } = await openState(
      page,
      request,
      'PAYEE_SEQUESTRE',
      'EN_ROUTE',
      'PRESTATAIRE',
      {
        browserGeolocation: initialPosition,
        useFixtureViewerIdentity: true,
      },
    );

    await expect(page.locator('.appointment-detail__google-map')).toBeVisible();
    await page.waitForFunction(
      () =>
        ((window as typeof window & { __jokkoGeoWatcherCount?: number })
          .__jokkoGeoWatcherCount ?? 0) > 0,
    );
    await page.waitForFunction(() => {
      const debug = (window as typeof window & { __jokkoMapDebug?: MapDebugState }).__jokkoMapDebug;
      return Boolean(debug?.cameras.length || debug?.centers.length);
    });
    await page.waitForTimeout(2_100);

    await page.evaluate((position) => {
      const emit = (window as typeof window & {
        __jokkoEmitGeolocation?: (position: GeolocationPosition) => void;
      }).__jokkoEmitGeolocation;
      emit?.({
        coords: {
          latitude: position.latitude,
          longitude: position.longitude,
          accuracy: 9,
          altitude: null,
          altitudeAccuracy: null,
          heading: 42,
          speed: 6,
        },
        timestamp: Date.now(),
      } as GeolocationPosition);
    }, offCoursePosition);

    await expect.poll(() => locationUpdates.length).toBeGreaterThan(0);
    expect(locationUpdates.at(-1)).toMatchObject({
      latitude: offCoursePosition.latitude,
      longitude: offCoursePosition.longitude,
      headingDegrees: 42,
    });
    await expect.poll(() => routeRequests.length).toBeGreaterThan(0);
    expect(routeRequests.at(-1)?.origin).toMatchObject(offCoursePosition);

    await page.waitForFunction((position) => {
      const debug = (window as typeof window & { __jokkoMapDebug?: MapDebugState }).__jokkoMapDebug;
      const lastCamera = debug?.cameras.at(-1);
      const lastCenter = lastCamera?.center ?? debug?.centers.at(-1);
      if (!lastCenter) return false;
      return (
        Math.abs(lastCenter.lat - position.latitude) < 0.0004 &&
        Math.abs(lastCenter.lng - position.longitude) < 0.0004
      );
    }, offCoursePosition);

    await page.waitForFunction((position) => {
      const debug = (window as typeof window & { __jokkoMapDebug?: MapDebugState }).__jokkoMapDebug;
      const providerPosition = debug?.providerMarkerPositions.at(-1);
      if (!providerPosition) return false;
      return (
        Math.abs(providerPosition.lat - position.latitude) < 0.00001 &&
        Math.abs(providerPosition.lng - position.longitude) < 0.00001
      );
    }, offCoursePosition);
    const debug = await page.evaluate(
      () => (window as typeof window & { __jokkoMapDebug?: MapDebugState }).__jokkoMapDebug,
    );
    expect(debug?.headings.some((heading) => Math.abs(heading - 42) < 2)).toBeTruthy();
  });

  test('client follower sees provider arrival jump directly to the destination', async ({
    page,
    request,
  }) => {
    const destination = { latitude: 14.74584, longitude: -17.40015 };
    const { markTravelerArrivedOnServer } = await openState(
      page,
      request,
      'PAYEE_SEQUESTRE',
      'EN_ROUTE',
      undefined,
      {
        useFixtureViewerIdentity: true,
      },
    );

    await expect(page.locator('.appointment-detail__google-map')).toBeVisible();
    markTravelerArrivedOnServer();

    await page.waitForFunction((position) => {
      const debug = (window as typeof window & { __jokkoMapDebug?: MapDebugState }).__jokkoMapDebug;
      const providerPosition = debug?.providerMarkerPositions.at(-1);
      if (!providerPosition) return false;
      return (
        Math.abs(providerPosition.lat - position.latitude) < 0.00001 &&
        Math.abs(providerPosition.lng - position.longitude) < 0.00001
      );
    }, destination);
    await expect(page.getByText(/Sur place/i).first()).toBeVisible();
  });

  test('provider arrived can see the finish action', async ({ page, request }) => {
    await openState(page, request, 'EN_COURS', 'EN_PRESTATION', 'PRESTATAIRE');
    await expect(page.locator('.appointment-detail__provider-console-visual')).toBeVisible();
    await expect(page.getByText(/Temps de travail ecoule/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /Cloturer l'intervention/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Cloturer l'intervention/i })).toBeEnabled();
    await expect(page.getByRole('button', { name: /Satellite/i })).toHaveCount(0);
    await expect(page.getByRole('link', { name: /Google Maps/i })).toHaveCount(0);
  });

  test('doctor workbench keeps only medical actions during consultation', async ({
    page,
    request,
  }) => {
    await openState(page, request, 'EN_COURS', 'EN_PRESTATION', 'MEDECIN');
    await expect(page.getByText(/Dossier de soins/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /Aperçu ordonnance/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /^Terminer$/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Satellite/i })).toHaveCount(0);
    await expect(page.getByRole('link', { name: /Google Maps/i })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /Reçu médical/i })).toHaveCount(0);
    await expect(page.getByText(/Total estim/i)).toHaveCount(0);
  });

  test('completed service stops map, taxi and speech', async ({ page, request }) => {
    await openState(page, request, 'TERMINEE', 'TERMINEE');
    await expect(page.getByText(/Mission accomplie/i)).toBeVisible();
    await expect(page.locator('.appointment-tracking-stepper')).toBeVisible();
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
      await expect(page.locator('.appointment-detail__cancelled')).toBeVisible();
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
        await expect(page.getByText(/Rendez-vous en litige/i)).toBeVisible();
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
  viewerRole?: 'PRESTATAIRE' | 'MEDECIN',
  options: {
    scheduled?: 'today' | 'future';
    travelMode?: 'PRESTATAIRE_SE_DEPLACE' | 'CLIENT_SE_DEPLACE';
    browserGeolocation?: { latitude: number; longitude: number };
    routeDistanceMeters?: number;
    arrivedLocationWithoutRoute?: boolean;
    useFixtureViewerIdentity?: boolean;
  } = {},
): Promise<TrackingTestHarness> {
  const routeRequests: RouteRequestRecord[] = [];
  const locationUpdates: Array<{
    latitude?: number;
    longitude?: number;
    headingDegrees?: number | null;
  }> = [];
  let login: { data: { accessToken: string; user: Record<string, unknown> } } = {
    data: {
      accessToken: 'e2e-token',
      user: {
        id: clientFixtureId,
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
  let appointmentData = {
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
    lastLocationLabel: options.arrivedLocationWithoutRoute
      ? 'Client arrive a destination'
      : tracking.data.lastLocationLabel,
    route:
      trackingState === 'EN_ROUTE' && !options.arrivedLocationWithoutRoute
        ? fallbackRoute(options.routeDistanceMeters)
        : null,
    presence: {
      ...tracking.data.presence,
      status: trackingState,
      lastLatitude: 14.7405004,
      lastLongitude: -17.4749579,
    },
  };

  const browserUser = options.useFixtureViewerIdentity
    ? viewerRole
      ? {
          ...login.data.user,
          id: professionalUserFixtureId,
          role: viewerRole,
          nom: 'Dr Tracking',
        }
      : {
          ...login.data.user,
          id: clientFixtureId,
          role: 'CLIENT',
          nom: 'Client Tracking',
        }
    : viewerRole
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
      function installGoogleMapsMock(): void {
        const debug: MapDebugState = {
          centers: [],
          cameras: [],
          headings: [],
          markerPositions: [],
          providerMarkerPositions: [],
        };
        Object.defineProperty(window, '__jokkoMapDebug', {
          configurable: true,
          value: debug,
        });

        class MockBounds {
          readonly points: Array<{ lat: number; lng: number }> = [];
          extend(point: { lat: number; lng: number }): void {
            this.points.push(point);
          }
        }

        class MockMap {
          private zoom = 17;
          constructor(_element: HTMLElement, options: Record<string, unknown>) {
            const center = options['center'] as { lat: number; lng: number } | undefined;
            if (center) {
              debug.centers.push(center);
            }
          }
          setCenter(center: { lat: number; lng: number }): void {
            debug.centers.push(center);
          }
          setZoom(zoom: number): void {
            this.zoom = zoom;
          }
          setMapTypeId(): void {}
          setHeading(heading: number): void {
            debug.headings.push(heading);
          }
          setTilt(): void {}
          setOptions(): void {}
          getRenderingType(): string {
            return 'VECTOR';
          }
          fitBounds(bounds: MockBounds): void {
            const lastPoint = bounds.points.at(-1);
            if (lastPoint) {
              debug.centers.push(lastPoint);
            }
          }
          addListener(): unknown {
            return {};
          }
          moveCamera(cameraOptions: {
            center?: { lat: number; lng: number };
            zoom?: number;
            heading?: number;
            tilt?: number;
          }): void {
            debug.cameras.push(cameraOptions);
            if (cameraOptions.center) {
              debug.centers.push(cameraOptions.center);
            }
            if (typeof cameraOptions.heading === 'number') {
              debug.headings.push(cameraOptions.heading);
            }
            if (typeof cameraOptions.zoom === 'number') {
              this.zoom = cameraOptions.zoom;
            }
          }
          getZoom(): number {
            return this.zoom;
          }
        }

        class MockPolyline {
          constructor(_options: Record<string, unknown>) {}
          setMap(): void {}
          setOptions(): void {}
          setPath(): void {}
          addListener(): unknown {
            return {};
          }
        }

        class MockAdvancedMarkerElement {
          private markerPosition: { lat: number; lng: number } | null = null;
          content?: Node | null;
          map: unknown;
          title?: string;
          constructor(options: Record<string, unknown>) {
            this.content = options['content'] as Node | null;
            this.map = options['map'];
            this.title = options['title'] as string | undefined;
            this.position = options['position'] as { lat: number; lng: number } | null;
          }
          get position(): { lat: number; lng: number } | null {
            return this.markerPosition;
          }
          set position(value: { lat: number; lng: number } | null) {
            this.markerPosition = value;
            if (value) {
              debug.markerPositions.push(value);
              if (this.title === 'Prestataire en route') {
                debug.providerMarkerPositions.push(value);
              }
            }
          }
        }

        Object.defineProperty(window, 'google', {
          configurable: true,
          value: {
            maps: {
              Map: MockMap,
              Polyline: MockPolyline,
              LatLngBounds: MockBounds,
              SymbolPath: { FORWARD_CLOSED_ARROW: 1, CIRCLE: 0 },
              marker: { AdvancedMarkerElement: MockAdvancedMarkerElement },
              event: { clearInstanceListeners(): void {} },
            },
          },
        });
      }
      installGoogleMapsMock();
      if (browserGeolocation) {
        const geolocationWatchers = new Map<number, PositionCallback>();
        let nextWatchId = 1;
        const initialPosition = {
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
        } as GeolocationPosition;
        Object.defineProperty(window, '__jokkoEmitGeolocation', {
          configurable: true,
          value(position: GeolocationPosition): void {
            geolocationWatchers.forEach((success) => success(position));
          },
        });
        Object.defineProperty(window, '__jokkoGeoWatcherCount', {
          configurable: true,
          get(): number {
            return geolocationWatchers.size;
          },
        });
        Object.defineProperty(navigator, 'geolocation', {
          configurable: true,
          value: {
            getCurrentPosition(success: PositionCallback): void {
              success(initialPosition);
            },
            watchPosition(success: PositionCallback): number {
              const watchId = nextWatchId++;
              geolocationWatchers.set(watchId, success);
              success(initialPosition);
              return watchId;
            },
            clearWatch(watchId: number): void {
              geolocationWatchers.delete(watchId);
            },
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
    async (route) => {
      const payload = route.request().postDataJSON() as {
        latitude?: number;
        longitude?: number;
        accuracyMeters?: number | null;
        headingDegrees?: number | null;
        speedKmh?: number | null;
        locationLabel?: string | null;
      };
      locationUpdates.push({
        latitude: payload.latitude,
        longitude: payload.longitude,
        headingDegrees: payload.headingDegrees,
      });
      const arrived = payload.locationLabel?.toLowerCase().includes('arrive');
      trackingData = {
        ...trackingData,
        trackingStatus: arrived ? 'TERMINEE' : 'EN_ROUTE',
        lastLatitude: payload.latitude ?? 14.7405004,
        lastLongitude: payload.longitude ?? -17.4749579,
        lastAccuracyMeters: payload.accuracyMeters ?? null,
        lastHeadingDegrees: payload.headingDegrees ?? null,
        lastSpeedKmh: payload.speedKmh ?? null,
        lastLocationLabel: payload.locationLabel ?? trackingData.lastLocationLabel,
        route: arrived ? fallbackRoute(0) : fallbackRoute(options.routeDistanceMeters),
        presence: {
          ...trackingData.presence,
          status: arrived ? 'EN_PRESTATION' : trackingData.presence.status,
        },
      };
      if (arrived) {
        appointmentData = {
          ...appointmentData,
          statut: 'EN_COURS',
        };
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true, data: trackingData }),
      });
    },
  );
  await page.route('**/api/v1/maps/geocode**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: { latitude: 14.74584, longitude: -17.40015 },
      }),
    }),
  );
  await page.route('**/api/v1/maps/routes', async (route) => {
    const payload = route.request().postDataJSON() as RouteRequestRecord;
    routeRequests.push(payload);
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: [
          {
            distanceMeters: options.routeDistanceMeters ?? 7400,
            durationSeconds: options.routeDistanceMeters && options.routeDistanceMeters <= 120 ? 20 : 900,
            encodedPolyline: '',
            coordinates: fallbackRoute(options.routeDistanceMeters, payload.origin).coordinates,
            navigationSteps: fallbackRoute(options.routeDistanceMeters, payload.origin).navigationSteps,
          },
        ],
      }),
    });
  });

  await page.goto(`/appointments/${reservationId}`);
  await expect(page.locator('app-appointment-detail-loading')).toBeHidden({
    timeout: 15_000,
  });

  return {
    routeRequests,
    locationUpdates,
    markTravelerArrivedOnServer: () => {
      const destination = { latitude: 14.74584, longitude: -17.40015 };
      trackingData = {
        ...trackingData,
        trackingStatus: 'TERMINEE',
        lastLatitude: destination.latitude,
        lastLongitude: destination.longitude,
        lastAccuracyMeters: 10,
        lastHeadingDegrees: null,
        lastSpeedKmh: 0,
        lastLocationLabel: 'Arrive a destination de Client Tracking',
        route: fallbackRoute(0, destination),
        presence: {
          ...trackingData.presence,
          status: 'EN_PRESTATION',
          lastLatitude: destination.latitude,
          lastLongitude: destination.longitude,
          lastAccuracyMeters: 10,
          lastHeadingDegrees: null,
          lastSpeedKmh: 0,
          lastLocationLabel: 'Arrive a destination de Client Tracking',
        },
      };
    },
  };
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
    clientId: clientFixtureId,
    professionnelId: professionalFixtureId,
    serviceId: serviceFixtureId,
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
      id: clientFixtureId,
      nom: 'Client Tracking',
      numeroTelephone: '+221770000000',
      email: 'client@example.com',
      adresse: 'Plateau, Dakar',
      urlAvatar: null,
    },
    service: {
      id: serviceFixtureId,
      profilProfessionnelId: professionalFixtureId,
      categorieId: categoryFixtureId,
      nom: 'Consultation a domicile',
      description: 'Service fixture pour verifier la carte.',
      prix: 15000,
      typePrix: 'FIXE',
      modeDeplacement: 'PRESTATAIRE_SE_DEPLACE',
      dureeMinutes: 45,
      estObligatoire: true,
      estDisponible: true,
      categorie: {
        id: categoryFixtureId,
        nom: 'Sante',
        urlIcone: null,
        tauxCommission: 10,
      },
    },
    professionnel: {
      id: professionalFixtureId,
      utilisateurId: professionalUserFixtureId,
      nomEntreprise: 'Dr Tracking',
      ville: 'Dakar',
      noteGlobale: 4.8,
      nombreAvis: 24,
      utilisateur: {
        id: professionalUserFixtureId,
        nom: 'Dr Tracking',
        numeroTelephone: '+221771111111',
        urlAvatar: null,
      },
    },
  };
}

function fallbackRoute(
  distanceMeters = 7400,
  origin = { latitude: 14.7405004, longitude: -17.4749579 },
): Record<string, unknown> {
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
      origin,
      destination,
    ],
    navigationSteps: [
      {
        id: 'step-1',
        instruction: 'Continuez vers la destination',
        maneuver: null,
        distanceMeters,
        durationSeconds,
        start: origin,
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
    clientUserId: clientFixtureId,
    professionalId: professionalFixtureId,
    professionalUserId: professionalUserFixtureId,
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
      professionalId: professionalFixtureId,
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

