import {
  NAVIGATION_CAMERA_CONFIG,
  NavigationCameraEngine,
  shortestAngleDelta,
} from './navigation-camera.engine';

const position = { lat: 14.7167, lng: -17.4677 };

describe('NavigationCameraEngine', () => {
  it('turns through north by the shortest heading delta', () => {
    expect(shortestAngleDelta(359, 1)).toBe(2);
    expect(shortestAngleDelta(1, 359)).toBe(-2);
  });

  it('increases the look-ahead and widens the view as speed increases', () => {
    const slowEngine = new NavigationCameraEngine();
    const fastEngine = new NavigationCameraEngine();
    const slow = slowEngine.decide({
      position,
      headingDegrees: 90,
      speedKmh: 5,
      accuracyMeters: 8,
      routeTarget: null,
    });
    const fast = fastEngine.decide({
      position,
      headingDegrees: 90,
      speedKmh: 120,
      accuracyMeters: 8,
      routeTarget: null,
    });

    expect(fast.lookAheadMeters).toBeGreaterThan(slow.lookAheadMeters);
    expect(fast.lookAheadMeters).toBeLessThanOrEqual(
      NAVIGATION_CAMERA_CONFIG.lookAhead.maxMeters,
    );
    expect(fast.zoom).toBeLessThan(slow.zoom);
  });

  it('prepares the view for a nearby maneuver without changing the marker position', () => {
    const farEngine = new NavigationCameraEngine();
    const nearEngine = new NavigationCameraEngine();
    const far = farEngine.decide({
      position,
      headingDegrees: 0,
      speedKmh: 45,
      accuracyMeters: 10,
      routeTarget: null,
      nextManeuverDistanceMeters: 220,
    });
    const near = nearEngine.decide({
      position,
      headingDegrees: 0,
      speedKmh: 45,
      accuracyMeters: 10,
      routeTarget: null,
      nextManeuverDistanceMeters: 20,
    });

    expect(near.zoom).toBeGreaterThan(far.zoom);
    expect(near.tilt).toBeLessThan(far.tilt);
  });

  it('reduces look-ahead when GPS accuracy is poor', () => {
    const accurateEngine = new NavigationCameraEngine();
    const uncertainEngine = new NavigationCameraEngine();
    const accurate = accurateEngine.decide({
      position,
      headingDegrees: 180,
      speedKmh: 70,
      accuracyMeters: 5,
      routeTarget: null,
    });
    const uncertain = uncertainEngine.decide({
      position,
      headingDegrees: 180,
      speedKmh: 70,
      accuracyMeters: 120,
      routeTarget: null,
    });

    expect(uncertain.confidence).toBe('UNRELIABLE');
    expect(uncertain.lookAheadMeters).toBeLessThan(accurate.lookAheadMeters);
  });
});
