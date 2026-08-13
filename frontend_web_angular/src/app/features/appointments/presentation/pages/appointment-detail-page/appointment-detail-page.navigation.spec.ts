import { AppointmentDetailPageComponent } from './appointment-detail-page.component';

describe('AppointmentDetailPageComponent - rerouting state contracts', () => {
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
  component['tracking'] = () => ({ lastAccuracyMeters: 8, presence: {} });
  component['geo'] = {
    distanceMetersBetweenPoints: (
      first: { lat: number; lng: number },
      second: { lat: number; lng: number },
    ) => Math.hypot(first.lat - second.lat, first.lng - second.lng) * 111_320,
    isCoordinateInSenegal: () => true,
  };
  return component;
}

function writableValue<T>(initial: T): (() => T) & { set(value: T): void } {
  let value = initial;
  const accessor = (() => value) as (() => T) & { set(value: T): void };
  accessor.set = (next) => { value = next; };
  return accessor;
}
