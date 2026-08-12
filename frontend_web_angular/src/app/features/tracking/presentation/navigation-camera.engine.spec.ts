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

  it.each([20, 50, 85, 130])('produces a stable forward camera target at %i km/h', (speedKmh) => {
    const engine = new NavigationCameraEngine();
    const decision = engine.decide({
      position,
      headingDegrees: 90,
      speedKmh,
      accuracyMeters: 6,
      routeTarget: { lat: position.lat, lng: position.lng + 0.001 },
      routeBearingDegrees: 90,
      futureRouteBearingDegrees: 90,
      routeConfidence: 0.95,
    });

    expect(decision.target.lng).toBeGreaterThan(position.lng);
    expect(decision.headingDegrees).toBeCloseTo(90, 5);
    expect(decision.lookAheadMeters).toBeGreaterThan(0);
  });

  it.each([
    [45, 45],
    [90, 90],
  ])('anticipates a %i degree turn before reaching it', (_label, turnDegrees) => {
    const engine = new NavigationCameraEngine();
    const decision = engine.decide({
      position,
      headingDegrees: 0,
      speedKmh: 50,
      accuracyMeters: 7,
      routeTarget: { lat: position.lat + 0.001, lng: position.lng },
      routeBearingDegrees: 0,
      futureRouteBearingDegrees: turnDegrees,
      routeConfidence: 0.95,
      nextManeuverDistanceMeters: 80,
    });

    expect(decision.headingDegrees).toBeGreaterThan(0);
    expect(decision.headingDegrees).toBeLessThan(turnDegrees);
  });

  it('anticipates successive roundabout-like heading changes without crossing the long angle path', () => {
    const engine = new NavigationCameraEngine();
    const headings = [20, 55, 95, 140].map((futureRouteBearingDegrees) =>
      engine.decide({
        position,
        headingDegrees: 0,
        speedKmh: 35,
        accuracyMeters: 8,
        routeTarget: null,
        routeBearingDegrees: 0,
        futureRouteBearingDegrees,
        routeConfidence: 0.9,
      }).headingDegrees,
    );

    expect(headings.every((heading, index) => index === 0 || heading >= headings[index - 1])).toBe(
      true,
    );
    expect(headings.at(-1)).toBeLessThan(180);
  });

  it('keeps route bearing dominant with good confidence and compass dominant at low confidence', () => {
    const confident = new NavigationCameraEngine().decide({
      position,
      headingDegrees: 20,
      speedKmh: 50,
      accuracyMeters: 8,
      routeTarget: null,
      routeBearingDegrees: 90,
      futureRouteBearingDegrees: 90,
      routeConfidence: 1,
    });
    const uncertain = new NavigationCameraEngine().decide({
      position,
      headingDegrees: 20,
      speedKmh: 4,
      accuracyMeters: 120,
      routeTarget: null,
      routeBearingDegrees: 90,
      futureRouteBearingDegrees: 90,
      routeConfidence: 0.2,
    });

    expect(Math.abs(90 - confident.headingDegrees)).toBeLessThan(Math.abs(90 - 20));
    expect(uncertain.headingDegrees).toBeCloseTo(20, 5);
  });
});
