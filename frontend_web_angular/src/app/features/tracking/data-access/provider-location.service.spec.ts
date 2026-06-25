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
});
