import { ProviderLocationService } from './provider-location.service';

describe('ProviderLocationService', () => {
  it('normalizes GPS speed and clears the browser watcher on unsubscribe', () => {
    let success:
      | ((position: GeolocationPosition) => void)
      | undefined;
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

  it('updates orientation from the phone compass without moving the GPS position', () => {
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
    success?.(thisPosition(14.71671, -17.46769, 10, null, 0));
    subscription.unsubscribe();

    expect(received[1]?.latitude).toBe(received[0]?.latitude);
    expect(received[1]?.heading).not.toBe(received[0]?.heading);
  });
});

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
    timestamp: Date.now(),
    toJSON: () => ({}),
  };
}
