import { AppointmentDetailPageComponent } from './appointment-detail-page.component';

describe('AppointmentDetailPageComponent - rerouting state contracts', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts the autonomous timer when a valid fast reroute is installed', () => {
    vi.useFakeTimers();
    const component = joiningComponent();
    component['routeMatchMode'] = 'REROUTING';
    component['routeCoordinatesKey'] = 'route-key';
    component['routeRequestContext'] = new Map([[1, {
      provider: [0, 0],
      destination: [0, 0.01],
      key: 'route-key',
      preserveCurrentRoute: true,
      fastReroute: true,
      requestedAtMs: Date.now(),
    }]]);
    component['currentReservationTrackingPoint'] = () => ({ lat: 0, lng: 0 });
    component['routeService'] = {
      mapGoogleRoutes: () => [{
        id: 'google',
        coordinates: [[0, 0], [0, 0.01]],
        distanceKm: 4.2,
        durationMinutes: 10,
        navigationSteps: [],
      }],
    };
    component['selectedRouteId'] = writableValue('route-old');
    component['routeOptions'] = [];
    component['routeDestinationKey'] = '';
    component['routeAlternatives'] = writableValue([]);
    component['refreshRouteAlternatives'] = vi.fn();
    component['clearNavigationRetry'] = vi.fn();
    component['updateGoogleMaps'] = vi.fn();
    component['announceNavigationInstruction'] = vi.fn();
    component['geo'].routePointKey = () => 'destination';

    component['applyRouteRecalculationResult']({
      request: {
        generation: 1,
        requestedAtMs: Date.now(),
        origin: { lat: 0, lng: 0 },
        input: {
          origin: { latitude: 0, longitude: 0 },
          destination: { latitude: 0, longitude: 0.01 },
        },
      },
      result: [{}],
    });

    expect(component['routeMatchMode']).toBe('JOINING_ROUTE');
    expect(component['routeJoinTimeoutId']).toBeDefined();
  });

  it('expires JOINING_ROUTE autonomously at 8 seconds without a new GPS sample', () => {
    vi.useFakeTimers();
    const component = joiningComponent();
    const retry = vi.fn();
    component['scheduleNavigationRetry'] = retry;

    component['startRouteJoiningTimer']();
    expect(component['routeJoinTimeoutId']).toBeDefined();
    vi.advanceTimersByTime(7_999);
    expect(component['routeMatchMode']).toBe('JOINING_ROUTE');
    expect(retry).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(component['routeMatchMode']).toBe('REROUTING');
    expect(component['routeCoordinates']).toHaveLength(2);
    expect(component['routeDistanceKm']()).toBe(4.2);
    expect(retry).toHaveBeenCalledOnce();
    expect(retry).toHaveBeenCalledWith(0);
  });

  it('recalculates from the latest raw GPS when the autonomous timer expires', () => {
    vi.useFakeTimers();
    const component = joiningComponent();
    const load = vi.fn();
    component['appointment'] = () => ({ id: 'reservation' });
    component['isAppointmentCompleted'] = () => false;
    component['isProviderOnTheWay'] = () => true;
    component['isParcelDropoffNavigationActive'] = () => false;
    component['destinationCoordinates'] = () => ({ lat: 14.75, lng: -17.43 });
    component['trackingLatitude'] = () => 14.725;
    component['trackingLongitude'] = () => -17.455;
    component['loadRouteCoordinates'] = load;
    component['startRouteJoiningTimer']();

    vi.advanceTimersByTime(8_000);
    vi.runOnlyPendingTimers();

    expect(load).toHaveBeenCalledWith(
      [14.725, -17.455],
      [14.75, -17.43],
      true,
      true,
    );
    expect(component['navigationRetryAttempts']).toBe(1);
  });

  it('expires even when the same timestamp is repeated during the whole join window', () => {
    vi.useFakeTimers();
    const component = joiningComponent();
    const retry = vi.fn();
    component['scheduleNavigationRetry'] = retry;
    component['startRouteJoiningTimer']();

    for (let index = 0; index < 8; index += 1) {
      component['confirmJoiningRoute']([0.00001, 0.001], 1_000, { lat: 0, lng: 0.01 });
      vi.advanceTimersByTime(1_000);
    }

    expect(component['routeMatchMode']).toBe('REROUTING');
    expect(retry).toHaveBeenCalledOnce();
  });

  it('cancels the autonomous timer immediately after MATCHED is confirmed', () => {
    vi.useFakeTimers();
    const component = joiningComponent();
    const retry = vi.fn();
    component['scheduleNavigationRetry'] = retry;
    component['startRouteJoiningTimer']();

    component['confirmJoiningRoute']([0.00001, 0.001], 1_000, { lat: 0, lng: 0.01 });
    component['confirmJoiningRoute']([0.00001, 0.0012], 2_000, { lat: 0, lng: 0.01 });
    expect(component['routeMatchMode']).toBe('MATCHED');
    expect(component['routeJoinTimeoutId']).toBeUndefined();

    vi.advanceTimersByTime(8_000);
    expect(retry).not.toHaveBeenCalled();
  });

  it('prevents an old timer generation from changing a newer JOINING_ROUTE', () => {
    vi.useFakeTimers();
    const component = joiningComponent();
    const retry = vi.fn();
    component['scheduleNavigationRetry'] = retry;
    component['startRouteJoiningTimer']();
    const oldGeneration = component['routeJoinGeneration'];
    component['startRouteJoiningTimer']();
    expect(component['routeJoinGeneration']).toBeGreaterThan(oldGeneration);

    vi.advanceTimersByTime(7_999);
    expect(component['routeMatchMode']).toBe('JOINING_ROUTE');
    expect(retry).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(retry).toHaveBeenCalledOnce();
  });

  it('cleans the timer on destroy and ignores every late callback', () => {
    vi.useFakeTimers();
    const component = joiningComponent();
    const retry = vi.fn();
    component['scheduleNavigationRetry'] = retry;
    component['startRouteJoiningTimer']();
    component['refreshParcelCheckpoints'] = vi.fn();
    component['appointment'] = () => null;
    component['stopLiveNavigation'] = vi.fn();
    component['exitMapFullscreen'] = vi.fn();
    component['clearNavigationRetry'] = vi.fn();
    component['routeRecalculation'] = { destroy: vi.fn() };
    component['clearLocationRecovery'] = vi.fn();
    component['trackingStore'] = { reset: vi.fn() };

    component['ngOnDestroy']();

    vi.advanceTimersByTime(20_000);
    expect(retry).not.toHaveBeenCalled();
    expect(component['routeMatchMode']).toBe('JOINING_ROUTE');
    expect(component['componentDestroyed']).toBe(true);
    expect(component['routeJoinTimeoutId']).toBeUndefined();
  });

  it('never schedules a fourth retry or a concurrent retry timer', () => {
    vi.useFakeTimers();
    const component = joiningComponent();
    component['navigationRetryAttempts'] = 3;
    component['scheduleNavigationRetry'](0);
    expect(component['navigationRetryTimeoutId']).toBeUndefined();
    expect(component['navigationRetryAttempts']).toBe(3);
  });

  it('keeps JOINING_ROUTE for one timestamp and matches only after two distinct samples', () => {
    const component = bareComponent();
    component['routeCoordinates'] = [[0, 0], [0, 0.01]];
    component['routeMatchMode'] = 'JOINING_ROUTE';
    component['routeJoinStartedAtMs'] = Date.now();

    const confirm = component['confirmJoiningRoute'].bind(component);
    confirm([0.00001, 0.001], 1_000, { lat: 0, lng: 0.01 });
    expect(component['routeMatchMode']).toBe('JOINING_ROUTE');
    expect(component['routeJoinConfirmations']).toBe(1);

    confirm([0.00001, 0.0011], 1_000, { lat: 0, lng: 0.01 });
    expect(component['routeJoinConfirmations']).toBe(1);
    expect(component['routeMatchMode']).toBe('JOINING_ROUTE');

    confirm([0.00001, 0.0012], 2_000, { lat: 0, lng: 0.01 });
    expect(component['routeMatchMode']).toBe('MATCHED');
  });

  it('keeps JOINING_ROUTE when raw GPS remains outside the route corridor', () => {
    const component = bareComponent();
    component['routeCoordinates'] = [[0, 0], [0, 0.01]];
    component['routeMatchMode'] = 'JOINING_ROUTE';
    component['routeJoinStartedAtMs'] = Date.now();

    component['confirmJoiningRoute']([0.001, 0.001], 1_000, { lat: 0, lng: 0.01 });
    component['confirmJoiningRoute']([0.001, 0.0011], 2_000, { lat: 0, lng: 0.01 });

    expect(component['routeMatchMode']).toBe('JOINING_ROUTE');
    expect(component['routeJoinConfirmations']).toBe(0);
  });

  it('accepts two eastbound samples with a GPS heading close to 90 degrees', () => {
    const component = joiningComponent({ heading: 92, speedKmh: 20 });
    component['confirmJoiningRoute']([0.00001, 0.001], 1_000, { lat: 0, lng: 0.01 });
    component['confirmJoiningRoute']([0.00001, 0.0012], 2_000, { lat: 0, lng: 0.01 });
    expect(component['routeMatchMode']).toBe('MATCHED');
  });

  it('rejects an opposite 270 degree heading on an eastbound route', () => {
    const component = joiningComponent({ heading: 270, speedKmh: 20 });
    component['confirmJoiningRoute']([0.00001, 0.001], 1_000, { lat: 0, lng: 0.01 });
    component['confirmJoiningRoute']([0.00001, 0.0012], 2_000, { lat: 0, lng: 0.01 });
    expect(component['routeJoinConfirmations']).toBe(0);
    expect(component['routeMatchMode']).toBe('JOINING_ROUTE');
  });

  it('resets confirmations when the second sample points in the opposite direction', () => {
    const component = joiningComponent({ heading: 90, speedKmh: 20 });
    component['confirmJoiningRoute']([0.00001, 0.001], 1_000, { lat: 0, lng: 0.01 });
    component['_trackingValue'].lastHeadingDegrees = 270;
    component['confirmJoiningRoute']([0.00001, 0.0012], 2_000, { lat: 0, lng: 0.01 });
    expect(component['routeJoinConfirmations']).toBe(0);
  });

  it('uses the shortest angular path for 359 degrees against a 1 degree segment', () => {
    const component = joiningComponent({ heading: 359, speedKmh: 20 });
    component['routeCoordinates'] = [[0, 0], [0.01, 0.0001745]];
    component['confirmJoiningRoute']([0.001, 0.000017], 1_000, { lat: 0.01, lng: 0.0001745 });
    component['confirmJoiningRoute']([0.0012, 0.000021], 2_000, { lat: 0.01, lng: 0.0001745 });
    expect(component['routeMatchMode']).toBe('MATCHED');
  });

  it('does not make unstable heading blocking below 5 km/h', () => {
    const component = joiningComponent({ heading: 270, speedKmh: 4.9 });
    component['confirmJoiningRoute']([0.00001, 0.001], 1_000, { lat: 0, lng: 0.01 });
    component['confirmJoiningRoute']([0.00001, 0.0012], 2_000, { lat: 0, lng: 0.01 });
    expect(component['routeMatchMode']).toBe('MATCHED');
  });

  it.each([null, undefined, Number.NaN, Number.POSITIVE_INFINITY])(
    'uses corridor and progression when heading is unavailable: %s',
    (heading) => {
      const component = joiningComponent({ heading, speedKmh: 20 });
      component['confirmJoiningRoute']([0.00001, 0.001], 1_000, { lat: 0, lng: 0.01 });
      component['confirmJoiningRoute']([0.00001, 0.0012], 2_000, { lat: 0, lng: 0.01 });
      expect(component['routeMatchMode']).toBe('MATCHED');
    },
  );

  it.each([
    ['stale age', 9_000, 0],
    ['origin drift', 100, 100],
  ])('releases calculating and preserves the old route after %s', (_label, ageMs, driftMeters) => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-13T12:00:09.000Z'));
    const component = bareComponent();
    const status = writableValue<'calculating' | 'ready' | 'unavailable'>('calculating');
    const retry = vi.fn();
    component['routeStatus'] = status;
    component['routeCoordinates'] = [[0, 0], [0, 0.01]];
    component['routeCoordinatesKey'] = 'route-key';
    component['routeRequestedDestinationKey'] = 'destination';
    component['routeMatchMode'] = 'REROUTING';
    component['routeRequestContext'] = new Map([[1, {
      provider: [0, 0],
      destination: [0, 0.01],
      key: 'route-key',
      preserveCurrentRoute: true,
      fastReroute: true,
      requestedAtMs: Date.now() - ageMs,
    }]]);
    component['currentReservationTrackingPoint'] = () => ({ lat: 0, lng: 0 });
    component['geo'] = {
      ...component['geo'],
      distanceMetersBetweenPoints: () => driftMeters,
    };
    component['scheduleNavigationRetry'] = retry;

    component['applyRouteRecalculationResult']({
      request: {
        generation: 1,
        requestedAtMs: Date.now() - ageMs,
        origin: { lat: 0, lng: 0 },
        input: {
          origin: { latitude: 0, longitude: 0 },
          destination: { latitude: 0, longitude: 0.01 },
        },
      },
      result: [],
    });

    expect(status()).toBe('ready');
    expect(component['routeCoordinates']).toHaveLength(2);
    expect(component['routeCoordinatesKey']).toBe('');
    expect(component['routeMatchMode']).toBe('REROUTING');
    expect(retry).toHaveBeenCalledTimes(1);
    vi.useRealTimers();
  });
});

function bareComponent(): Record<string, any> {
  const component = Object.create(AppointmentDetailPageComponent.prototype) as Record<string, any>;
  component['routeJoinConfirmations'] = 0;
  component['routeJoinLastPositionTimestampMs'] = null;
  component['routeJoinLastProgressMeters'] = null;
  component['routeJoinStartedAtMs'] = 0;
  component['routeJoinGeneration'] = 0;
  component['routeJoinTimeoutId'] = undefined;
  component['componentDestroyed'] = false;
  component['_trackingValue'] = {
    lastAccuracyMeters: 8,
    lastHeadingDegrees: null,
    lastSpeedKmh: null,
    presence: {},
  };
  component['tracking'] = () => component['_trackingValue'];
  component['geo'] = {
    distanceMetersBetweenPoints: (
      first: { lat: number; lng: number },
      second: { lat: number; lng: number },
    ) => Math.hypot(first.lat - second.lat, first.lng - second.lng) * 111_320,
    isCoordinateInSenegal: () => true,
  };
  return component;
}

function joiningComponent(options: { heading?: number | null; speedKmh?: number } = {}): Record<string, any> {
  const component = bareComponent();
  component['routeCoordinates'] = [[0, 0], [0, 0.01]];
  component['routeMatchMode'] = 'JOINING_ROUTE';
  component['routeCoordinatesKey'] = 'route';
  component['routeRequestedDestinationKey'] = 'destination';
  component['routeDistanceKm'] = writableValue<number | null>(4.2);
  component['routeDurationMinutes'] = writableValue<number | null>(10);
  component['routeStatus'] = writableValue<'ready' | 'unavailable'>('ready');
  component['navigationRetryAttempts'] = 0;
  component['componentDestroyed'] = false;
  component['_trackingValue'].lastHeadingDegrees = options.heading ?? null;
  component['_trackingValue'].lastSpeedKmh = options.speedKmh ?? null;
  return component;
}

function writableValue<T>(initial: T): (() => T) & { set(value: T): void } {
  let value = initial;
  const accessor = (() => value) as (() => T) & { set(value: T): void };
  accessor.set = (next) => { value = next; };
  return accessor;
}
