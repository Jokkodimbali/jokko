import { ProviderLocationService } from './provider-location.service';

describe('ProviderLocationService', () => {
  it('normalizes GPS speed and clears the browser watcher on unsubscribe', () => {
    let success: ((position: GeolocationPosition) => void) | undefined;
    const clearWatch = vi.fn();
    const geolocation = {
      watchPosition: vi.fn((handler: (position: GeolocationPosition) => void) => {
        success = handler;
        return 42;
      }),
      clearWatch,
    };
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: geolocation,
    });
    const service = new ProviderLocationService();
    const received: number[] = [];
    const subscription = service.watch(0).subscribe((position) => {
      received.push(position.speedKmh ?? 0);
    });

    success?.({
      coords: {
        latitude: 14.7167,
        longitude: -17.4677,
        accuracy: 7,
        altitude: null,
        altitudeAccuracy: null,
        heading: 90,
        speed: 10,
        toJSON: () => ({}),
      },
      timestamp: Date.now(),
      toJSON: () => ({}),
    });
    subscription.unsubscribe();

    expect(received).toEqual([36]);
    expect(clearWatch).toHaveBeenCalledWith(42);
  });

  it('keeps a stationary person fixed when GPS coordinates and heading drift', () => {
    let success: ((position: GeolocationPosition) => void) | undefined;
    const geolocation = {
      watchPosition: vi.fn((handler: (position: GeolocationPosition) => void) => {
        success = handler;
        return 7;
      }),
      clearWatch: vi.fn(),
    };
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: geolocation,
    });
    const service = new ProviderLocationService();
    const received: Array<{ latitude: number; longitude: number; heading: number | null }> = [];
    const subscription = service.watch(0).subscribe((position) => {
      received.push({
        latitude: position.latitude,
        longitude: position.longitude,
        heading: position.headingDegrees,
      });
    });

    success?.(thisPosition(14.7167, -17.4677, 8, 15, 0));
    success?.(thisPosition(14.716715, -17.46769, 12, 240, 0));
    subscription.unsubscribe();

    expect(received).toHaveLength(2);
    expect(received[1]).toEqual(received[0]);
  });

  it('updates orientation from the phone compass without waiting for another GPS event', () => {
    let success: ((position: GeolocationPosition) => void) | undefined;
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: {
        watchPosition: vi.fn((handler: (position: GeolocationPosition) => void) => {
          success = handler;
          return 8;
        }),
        clearWatch: vi.fn(),
      },
    });
    const service = new ProviderLocationService();
    const received: Array<{ latitude: number; heading: number | null }> = [];
    const subscription = service.watch(0).subscribe((position) => {
      received.push({ latitude: position.latitude, heading: position.headingDegrees });
    });

    window.dispatchEvent(orientationEvent(10));
    success?.(thisPosition(14.7167, -17.4677, 8, null, 0));
    window.dispatchEvent(orientationEvent(100));
    subscription.unsubscribe();

    expect(received).toHaveLength(2);
    expect(received[1]?.latitude).toBe(received[0]?.latitude);
    expect(received[1]?.heading).not.toBe(received[0]?.heading);
  });

  it('ignores an isolated speed value when the coordinates only drift', () => {
    let success: ((position: GeolocationPosition) => void) | undefined;
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: {
        watchPosition: vi.fn((handler: (position: GeolocationPosition) => void) => {
          success = handler;
          return 9;
        }),
        clearWatch: vi.fn(),
      },
    });
    const service = new ProviderLocationService();
    const received: ProviderCoordinates[] = [];
    const subscription = service.watch(0).subscribe((position) => {
      received.push({ latitude: position.latitude, longitude: position.longitude });
    });

    success?.(thisPosition(14.7167, -17.4677, 8, 90, 0));
    success?.(thisPosition(14.716706, -17.467696, 10, 90, 15));
    subscription.unsubscribe();

    expect(received[1]).toEqual(received[0]);
  });

  it('keeps a confirmed slow movement instead of waiting for a four-meter jump', () => {
    let success: ((position: GeolocationPosition) => void) | undefined;
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: {
        watchPosition: vi.fn((handler: (position: GeolocationPosition) => void) => {
          success = handler;
          return 10;
        }),
        clearWatch: vi.fn(),
      },
    });
    const service = new ProviderLocationService();
    const latitudes: number[] = [];
    const subscription = service.watch(0).subscribe((position) => {
      latitudes.push(position.latitude);
    });

    success?.(thisPosition(14.7167, -17.4677, 7, 0, 5));
    success?.(thisPosition(14.71672, -17.4677, 7, 0, 5));
    subscription.unsubscribe();

    expect(latitudes[1]).toBeGreaterThan(latitudes[0] ?? Number.POSITIVE_INFINITY);
  });

  it('smooths heading across north without rotating the long way around', () => {
    let success: ((position: GeolocationPosition) => void) | undefined;
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: {
        watchPosition: vi.fn((handler: (position: GeolocationPosition) => void) => {
          success = handler;
          return 11;
        }),
        clearWatch: vi.fn(),
      },
    });
    const service = new ProviderLocationService();
    const headings: Array<number | null> = [];
    const subscription = service.watch(0).subscribe((position) => {
      headings.push(position.headingDegrees);
    });

    success?.(thisPosition(14.7167, -17.4677, 6, 359, 20));
    success?.(thisPosition(14.71673, -17.4677, 6, 1, 20));
    subscription.unsubscribe();

    expect(headings[0]).toBe(359);
    expect(headings[1]).not.toBeNull();
    const distanceFromNorth = Math.min(
      Math.abs(headings[1] as number),
      Math.abs(360 - (headings[1] as number)),
    );
    expect(distanceFromNorth).toBeLessThan(2);
  });

  it('rejects an impossible isolated GPS jump', () => {
    let success: ((position: GeolocationPosition) => void) | undefined;
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: {
        watchPosition: vi.fn((handler: (position: GeolocationPosition) => void) => {
          success = handler;
          return 12;
        }),
        clearWatch: vi.fn(),
      },
    });
    const service = new ProviderLocationService();
    const received: ProviderCoordinates[] = [];
    const subscription = service.watch(0).subscribe((position) => {
      received.push({ latitude: position.latitude, longitude: position.longitude });
    });
    const startedAt = Date.now();

    success?.(thisPosition(14.7167, -17.4677, 6, 90, 25, startedAt));
    success?.(thisPosition(14.8067, -17.3677, 6, 90, 25, startedAt + 1000));
    subscription.unsubscribe();

    expect(received[1]).toEqual(received[0]);
  });

  it('uses the GPS measurement timestamp instead of the network reception time', () => {
    let success: ((position: GeolocationPosition) => void) | undefined;
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: {
        watchPosition: vi.fn((handler: (position: GeolocationPosition) => void) => {
          success = handler;
          return 13;
        }),
        clearWatch: vi.fn(),
      },
    });
    const service = new ProviderLocationService();
    const recordedAt: number[] = [];
    const subscription = service.watch(0).subscribe((position) => {
      recordedAt.push(position.recordedAt);
    });
    const measuredAt = Date.now() - 750;

    success?.(thisPosition(14.7167, -17.4677, 6, 90, 10, measuredAt));
    subscription.unsubscribe();

    expect(recordedAt).toEqual([measuredAt]);
  });

  it.each([
    ['arret', 0, 0],
    ['marche', 4.5, 1.25],
    ['velo ou circulation lente', 20, 5.56],
    ['ville fluide', 50, 13.89],
    ['autoroute', 130, 36.11],
    ['train rapide', 250, 69.44],
  ])('keeps coherent telemetry for %s at %d km/h', (_scenario, speedKmh, distanceMeters) => {
    let success: ((position: GeolocationPosition) => void) | undefined;
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: {
        watchPosition: vi.fn((handler: (position: GeolocationPosition) => void) => {
          success = handler;
          return 14;
        }),
        clearWatch: vi.fn(),
      },
    });
    const service = new ProviderLocationService();
    const received: ProviderCoordinates[] = [];
    const subscription = service.watch(0).subscribe((position) => {
      received.push({ latitude: position.latitude, longitude: position.longitude });
    });
    const measuredAt = Date.now();
    const latitudeDelta = distanceMeters / 111_111;

    success?.(thisPosition(14.7167, -17.4677, 6, 20, speedKmh / 3.6, measuredAt));
    success?.(
      thisPosition(
        14.7167 + latitudeDelta,
        -17.4677,
        6,
        20,
        speedKmh / 3.6,
        measuredAt + 1000,
      ),
    );
    subscription.unsubscribe();

    expect(received).toHaveLength(2);
    if (speedKmh === 0) {
      expect(received[1]).toEqual(received[0]);
    } else {
      expect(received[1]?.latitude).toBeGreaterThan(received[0]?.latitude ?? Number.POSITIVE_INFINITY);
    }
  });
});

type ProviderCoordinates = { latitude: number; longitude: number };

function orientationEvent(alpha: number): Event {
  const event = new Event('deviceorientationabsolute');
  Object.defineProperties(event, {
    absolute: { value: true },
    alpha: { value: alpha },
  });
  return event;
}

function thisPosition(
  latitude: number,
  longitude: number,
  accuracy: number,
  heading: number | null,
  speed: number | null,
  timestamp = Date.now(),
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
