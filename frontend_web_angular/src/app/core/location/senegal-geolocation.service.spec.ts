import { TestBed } from '@angular/core/testing';
import { SenegalGeolocationService } from './senegal-geolocation.service';

describe('SenegalGeolocationService', () => {
  let service: SenegalGeolocationService;
  let success: PositionCallback | undefined;
  let clearWatch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    clearWatch = vi.fn();
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: {
        clearWatch,
        watchPosition: vi.fn((next: PositionCallback) => {
          success = next;
          return 7;
        }),
      },
    });
    service = TestBed.inject(SenegalGeolocationService);
  });

  it('ignore une premiere mesure hors Senegal puis accepte la mesure GPS suivante', async () => {
    const result = service.getCurrentPosition();

    success?.(position(41.0082, 28.9784));
    success?.(position(14.7167, -17.4677));

    await expect(result).resolves.toMatchObject({
      latitude: 14.7167,
      longitude: -17.4677,
    });
    expect(clearWatch).toHaveBeenCalledWith(7);
  });

  it('refuse les coordonnees hors Senegal', () => {
    expect(service.isInSenegal(41.0082, 28.9784)).toBe(false);
    expect(service.isInSenegal(14.7167, -17.4677)).toBe(true);
  });
});

function position(latitude: number, longitude: number): GeolocationPosition {
  return {
    coords: {
      latitude,
      longitude,
      accuracy: 10,
      altitude: null,
      altitudeAccuracy: null,
      heading: null,
      speed: null,
      toJSON: () => ({}),
    },
    timestamp: Date.now(),
    toJSON: () => ({}),
  };
}
