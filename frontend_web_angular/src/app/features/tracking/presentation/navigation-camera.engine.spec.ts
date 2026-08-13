import {
  NAVIGATION_CAMERA_CONFIG,
  NavigationCameraEngine,
  NavigationCameraInput,
  shortestAngleDelta,
} from './navigation-camera.engine';

const POSITION = { lat: 14.7167, lng: -17.4677 };

function input(overrides: Partial<NavigationCameraInput> = {}): NavigationCameraInput {
  return {
    position: POSITION,
    headingDegrees: 90,
    speedKmh: 50,
    accuracyMeters: 8,
    routeTarget: null,
    routeBearingDegrees: 90,
    futureRouteBearingDegrees: 90,
    routeConfidence: 0.95,
    nextManeuverDistanceMeters: null,
    ...overrides,
  };
}

describe('NavigationCameraEngine - navigation contracts', () => {
  it('always uses the shortest angular path across north', () => {
    expect(shortestAngleDelta(359, 1)).toBe(2);
    expect(shortestAngleDelta(1, 359)).toBe(-2);
    expect(shortestAngleDelta(10, 350)).toBe(-20);
  });

  it.each([20, 50, 85, 130])(
    'keeps a forward target and route bearing at %i km/h',
    (speedKmh) => {
      const decision = new NavigationCameraEngine().decide(
        input({
          speedKmh,
          routeTarget: { lat: POSITION.lat, lng: POSITION.lng + 0.002 },
        }),
      );

      expect(decision.target.lng).toBeGreaterThan(POSITION.lng);
      expect(decision.headingDegrees).toBeCloseTo(90, 6);
      expect(decision.lookAheadMeters).toBeGreaterThan(0);
    },
  );

  it('increases look-ahead and widens the view with speed', () => {
    const slow = new NavigationCameraEngine().decide(input({ speedKmh: 5 }));
    const fast = new NavigationCameraEngine().decide(input({ speedKmh: 130 }));

    expect(fast.lookAheadMeters).toBeGreaterThan(slow.lookAheadMeters);
    expect(fast.lookAheadMeters).toBeLessThanOrEqual(
      NAVIGATION_CAMERA_CONFIG.lookAhead.maxMeters,
    );
    expect(fast.zoom).toBeLessThan(slow.zoom);
    expect(fast.tilt).toBeLessThan(slow.tilt);
  });

  it('reduces look-ahead when accuracy is unreliable', () => {
    const accurate = new NavigationCameraEngine().decide(input({ accuracyMeters: 5 }));
    const unreliable = new NavigationCameraEngine().decide(input({ accuracyMeters: 140 }));

    expect(unreliable.confidence).toBe('UNRELIABLE');
    expect(unreliable.lookAheadMeters).toBeLessThan(accurate.lookAheadMeters);
  });

  it.each([45, 90])('anticipates a %i degree turn before the maneuver', (turn) => {
    const decision = new NavigationCameraEngine().decide(
      input({
        headingDegrees: 0,
        routeBearingDegrees: 0,
        futureRouteBearingDegrees: turn,
        nextManeuverDistanceMeters: 80,
      }),
    );

    expect(decision.headingDegrees).toBeGreaterThan(0);
    expect(decision.headingDegrees).toBeLessThan(turn);
  });

  it('adapts zoom and tilt progressively near a maneuver', () => {
    const far = new NavigationCameraEngine().decide(
      input({ nextManeuverDistanceMeters: 250 }),
    );
    const near = new NavigationCameraEngine().decide(
      input({ nextManeuverDistanceMeters: 20 }),
    );

    expect(near.zoom).toBeGreaterThan(far.zoom);
    expect(near.tilt).toBeLessThan(far.tilt);
  });

  it('ignores erratic compass headings while driving on a confident straight route', () => {
    const engine = new NavigationCameraEngine();
    const headings = [90, 270, 15, 205, 92].map((headingDegrees) =>
      engine.decide(input({ headingDegrees, speedKmh: 70 })).headingDegrees,
    );

    expect(headings.every((heading) => Math.abs(shortestAngleDelta(heading, 90)) < 1)).toBe(true);
  });

  it('requires confirmation before accepting a large route-bearing inversion', () => {
    const engine = new NavigationCameraEngine();
    const initial = engine.decide(input({ speedKmh: 70 }));
    const isolatedInversion = engine.decide(
      input({
        speedKmh: 70,
        headingDegrees: 270,
        routeBearingDegrees: 270,
        futureRouteBearingDegrees: 270,
      }),
    );

    expect(isolatedInversion.headingDegrees).toBe(initial.headingDegrees);
  });

  it('accepts a confirmed real direction change progressively without overshoot', () => {
    const engine = new NavigationCameraEngine();
    const headings = [90, 180, 180, 180, 180].map((routeBearingDegrees) =>
      engine.decide(
        input({
          speedKmh: 45,
          headingDegrees: routeBearingDegrees,
          routeBearingDegrees,
          futureRouteBearingDegrees: routeBearingDegrees,
        }),
      ).headingDegrees,
    );

    expect(headings[1]).toBe(headings[0]);
    expect(headings.slice(2).every((heading) => heading >= 90 && heading <= 180)).toBe(true);
    expect(headings.at(-1)).toBeGreaterThan(headings[1] ?? 180);
  });

  it('keeps route priority while driving but compass priority at low confidence and speed', () => {
    const driving = new NavigationCameraEngine().decide(
      input({ headingDegrees: 20, speedKmh: 60, routeBearingDegrees: 90 }),
    );
    const walkingUnreliable = new NavigationCameraEngine().decide(
      input({
        headingDegrees: 20,
        speedKmh: 3,
        accuracyMeters: 140,
        routeBearingDegrees: 90,
        futureRouteBearingDegrees: 90,
        routeConfidence: 0.15,
      }),
    );

    expect(driving.headingDegrees).toBeCloseTo(90, 6);
    expect(walkingUnreliable.headingDegrees).toBeCloseTo(20, 6);
  });

  it('reset removes previous speed and heading memory', () => {
    const engine = new NavigationCameraEngine();
    engine.decide(input({ speedKmh: 120, routeBearingDegrees: 90 }));
    engine.reset();
    const resetDecision = engine.decide(
      input({ speedKmh: 5, headingDegrees: 180, routeBearingDegrees: null }),
    );

    expect(resetDecision.headingDegrees).toBeCloseTo(180, 6);
    expect(resetDecision.zoom).toBeGreaterThan(19.5);
  });
});
