import { ProviderGpsPosition, ProviderLocationService } from './provider-location.service';

describe('ProviderLocationService - real GPS filtering contracts', () => {
  let success: ((position: GeolocationPosition) => void) | undefined;
  let failure: PositionErrorCallback | undefined;
  let options: PositionOptions | undefined;
  let clearWatch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    success = undefined;
    failure = undefined;
    options = undefined;
    clearWatch = vi.fn();
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: {
        watchPosition: vi.fn(
          (
            onSuccess: (position: GeolocationPosition) => void,
            onFailure: PositionErrorCallback,
            requestedOptions: PositionOptions,
          ) => {
            success = onSuccess;
            failure = onFailure;
            options = requestedOptions;
            return 42;
          },
        ),
        clearWatch,
      },
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('requests fresh high-accuracy GPS and releases the watcher', () => {
    const subscription = new ProviderLocationService().watch(0).subscribe();
    expect(options).toEqual({ enableHighAccuracy: true, maximumAge: 0, timeout: 5000 });
    subscription.unsubscribe();
    expect(clearWatch).toHaveBeenCalledWith(42);
  });

  it('converts meters per second to km/h and preserves measurement time', () => {
    const received: ProviderGpsPosition[] = [];
    const subscription = new ProviderLocationService().watch(0).subscribe((gps) => received.push(gps));
    success?.(position(14.7167, -17.4677, 7, 90, 10, 1_234));
    subscription.unsubscribe();
    expect(received[0]?.speedKmh).toBe(36);
    expect(received[0]?.recordedAt).toBe(1_234);
  });

  it('rejects duplicate and regressive measurement timestamps', () => {
    const received: ProviderGpsPosition[] = [];
    const subscription = new ProviderLocationService().watch(0).subscribe((gps) => received.push(gps));
    success?.(position(14.7167, -17.4677, 7, 90, 10, 2_000));
    success?.(position(14.7167, -17.4677, 7, 90, 10, 2_000));
    success?.(position(14.7168, -17.4677, 7, 90, 10, 1_900));
    subscription.unsubscribe();
    expect(received).toHaveLength(1);
  });

  it('keeps a stationary phone fixed despite coordinate and heading drift', () => {
    const received: ProviderGpsPosition[] = [];
    const subscription = new ProviderLocationService().watch(0).subscribe((gps) => received.push(gps));
    success?.(position(14.7167, -17.4677, 8, 15, 0, 1_000));
    success?.(position(14.716715, -17.46769, 12, 240, 0, 2_000));
    subscription.unsubscribe();
    expect(received[1]?.latitude).toBe(received[0]?.latitude);
    expect(received[1]?.longitude).toBe(received[0]?.longitude);
    expect(received[1]?.headingDegrees).toBe(received[0]?.headingDegrees);
    expect(received[1]?.speedKmh).toBe(0);
  });

  it('ignores an isolated non-zero speed when coordinates only drift', () => {
    const received: ProviderGpsPosition[] = [];
    const subscription = new ProviderLocationService().watch(0).subscribe((gps) => received.push(gps));
    success?.(position(14.7167, -17.4677, 8, 90, 0, 1_000));
    success?.(position(14.716706, -17.467696, 10, 90, 15, 2_000));
    subscription.unsubscribe();
    expect(received[1]?.latitude).toBe(received[0]?.latitude);
    expect(received[1]?.longitude).toBe(received[0]?.longitude);
  });

  it.each([
    [4.5, 1.25],
    [20, 5.56],
    [50, 13.89],
    [85, 23.61],
    [130, 36.11],
  ])('accepts coherent movement at %i km/h', (speedKmh, meters) => {
    const received: ProviderGpsPosition[] = [];
    const subscription = new ProviderLocationService().watch(0).subscribe((gps) => received.push(gps));
    success?.(position(14.7167, -17.4677, 6, 0, speedKmh / 3.6, 1_000));
    success?.(position(14.7167 + meters / 111_111, -17.4677, 6, 0, speedKmh / 3.6, 2_000));
    subscription.unsubscribe();
    expect(received[1]?.latitude).toBeGreaterThan(received[0]?.latitude ?? Infinity);
  });

  it('smooths heading through 359 to 1 without taking the long path', () => {
    const received: ProviderGpsPosition[] = [];
    const subscription = new ProviderLocationService().watch(0).subscribe((gps) => received.push(gps));
    success?.(position(14.7167, -17.4677, 6, 359, 20, 1_000));
    success?.(position(14.71673, -17.4677, 6, 1, 20, 2_000));
    subscription.unsubscribe();
    const heading = received[1]?.headingDegrees ?? 180;
    expect(Math.min(Math.abs(heading), Math.abs(360 - heading))).toBeLessThan(2);
  });

  it('rejects an impossible isolated jump but accepts three coherent relocation samples', () => {
    const received: ProviderGpsPosition[] = [];
    const subscription = new ProviderLocationService().watch(0).subscribe((gps) => received.push(gps));
    success?.(position(14.7167, -17.4677, 6, 90, 25, 1_000));
    success?.(position(14.8067, -17.3677, 6, 90, 25, 2_000));
    success?.(position(14.80671, -17.36769, 6, 90, 25, 3_000));
    success?.(position(14.80672, -17.36768, 6, 90, 25, 4_000));
    subscription.unsubscribe();
    expect(received[1]?.latitude).toBe(received[0]?.latitude);
    expect(received[2]?.latitude).toBe(received[0]?.latitude);
    expect(received[3]?.latitude).toBeCloseTo(14.80672, 5);
  });

  it('respects the requested emission interval for irregular browser callbacks', () => {
    vi.useFakeTimers();
    vi.setSystemTime(1_000);
    const received: ProviderGpsPosition[] = [];
    const subscription = new ProviderLocationService().watch(1_000).subscribe((gps) => received.push(gps));
    success?.(position(14.7167, -17.4677, 6, 90, 10, 1_000));
    vi.advanceTimersByTime(900);
    success?.(position(14.71671, -17.4677, 6, 90, 10, 1_900));
    vi.advanceTimersByTime(100);
    success?.(position(14.71672, -17.4677, 6, 90, 10, 2_000));
    subscription.unsubscribe();
    expect(received.map((gps) => gps.recordedAt)).toEqual([1_000, 2_000]);
  });

  it('forwards native geolocation errors', () => {
    const errors: unknown[] = [];
    const subscription = new ProviderLocationService().watch(0).subscribe({ error: (error) => errors.push(error) });
    const denied = { code: 1, message: 'denied' } as GeolocationPositionError;
    failure?.(denied);
    subscription.unsubscribe();
    expect(errors).toEqual([denied]);
  });
});

function position(
  latitude: number,
  longitude: number,
  accuracy: number,
  heading: number | null,
  speed: number | null,
  timestamp: number,
): GeolocationPosition {
  return {
    coords: {
      latitude,
      longitude,
      accuracy,
      altitude: null,
      altitudeAccuracy: null,
      heading,
      speed,
      toJSON: () => ({}),
    },
    timestamp,
    toJSON: () => ({}),
  };
}
