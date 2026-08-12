import { TestBed } from '@angular/core/testing';
import {
  GoogleMapsLoaderService,
  GoogleMapsPoint,
} from '../../../shared/maps/google-maps-loader.service';
import {
  TrackingGoogleMapRendererService,
  TrackingMapRenderState,
} from './tracking-google-map-renderer.service';
import { shortestAngleDelta } from './navigation-camera.engine';

const routeState: TrackingMapRenderState = {
  provider: { lat: 0, lng: 0 },
  destination: { lat: 0, lng: 0.02 },
  routes: [
    {
      id: 'selected-route',
      selected: true,
      coordinates: [
        { lat: 0, lng: 0 },
        { lat: 0, lng: 0.02 },
      ],
    },
  ],
  destinationMarker: { title: 'Arrivee', subtitle: '', etaLabel: '2 min', accent: 'blue' },
  remainingLabel: '2 min',
  statusLabel: 'En route',
  headingDegrees: 90,
  arrived: false,
  travelerMarker: {
    kind: 'navigation',
    imageUrl: null,
    initials: 'J',
    name: 'Jokko',
    roleLabel: 'En route',
  },
};

describe('TrackingGoogleMapRendererService marker position', () => {
  let renderer: TrackingGoogleMapRendererService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        TrackingGoogleMapRendererService,
        { provide: GoogleMapsLoaderService, useValue: {} },
      ],
    });
    renderer = TestBed.inject(TrackingGoogleMapRendererService);
  });

  it('projects a nearby GPS position onto the selected route for navigation display', () => {
    const position = { lat: 0.00005, lng: 0.005 };
    const internals = renderer as unknown as Record<string, unknown>;
    internals['google'] = {};
    internals['routeMap'] = {};
    internals['upsertDestinationMarker'] = () => undefined;
    internals['routesStartingAtProvider'] = () => [];
    internals['renderRoutes'] = () => undefined;
    internals['fitRoute'] = () => undefined;
    internals['refreshRenderedTravelerMarker'] = () => undefined;
    const renderedPositions: GoogleMapsPoint[] = [];
    internals['upsertProviderMarker'] = (
      _marker: unknown,
      _map: unknown,
      provider: GoogleMapsPoint,
    ) => {
      renderedPositions.push(provider);
      return undefined;
    };

    renderer.render({
      ...routeState,
      provider: position,
      accuracyMeters: 10,
    });

    expect(renderedPositions[0]?.lat).toBeCloseTo(0, 7);
    expect(renderedPositions[0]?.lng).toBeCloseTo(0.005, 7);
  });

  it('keeps the displayed marker snapped even when raw GPS is off route', () => {
    const position = { lat: 0.001, lng: 0.005 };
    const internals = renderer as unknown as {
      snapTravelerMarkerToSelectedRoute: (
        point: GoogleMapsPoint,
        state: TrackingMapRenderState,
      ) => GoogleMapsPoint;
    };

    const displayed = internals.snapTravelerMarkerToSelectedRoute(position, {
      ...routeState,
      accuracyMeters: 8,
    });
    expect(displayed.lat).toBeCloseTo(0, 7);
    expect(displayed.lng).toBeCloseTo(0.005, 7);
  });

  it('keeps the marker on route even when GPS accuracy is degraded', () => {
    const position = { lat: 0.00005, lng: 0.005 };
    const internals = renderer as unknown as {
      snapTravelerMarkerToSelectedRoute: (
        point: GoogleMapsPoint,
        state: TrackingMapRenderState,
      ) => GoogleMapsPoint;
    };

    const displayed = internals.snapTravelerMarkerToSelectedRoute(position, {
      ...routeState,
      accuracyMeters: 90,
    });
    expect(displayed.lat).toBeCloseTo(0, 7);
    expect(displayed.lng).toBeCloseTo(0.005, 7);
  });

  it('projects intermediate animation frames onto curved route segments', () => {
    const internals = renderer as unknown as {
      snapPointToRoute: (
        point: GoogleMapsPoint,
        route: GoogleMapsPoint[],
      ) => GoogleMapsPoint;
    };

    const displayed = internals.snapPointToRoute(
      { lat: 0.0005, lng: 0.0005 },
      [
        { lat: 0, lng: 0 },
        { lat: 0, lng: 0.001 },
        { lat: 0.001, lng: 0.001 },
      ],
    );

    const liesOnHorizontalSegment = Math.abs(displayed.lat) < 1e-9;
    const liesOnVerticalSegment = Math.abs(displayed.lng - 0.001) < 1e-9;
    expect(liesOnHorizontalSegment || liesOnVerticalSegment).toBe(true);
  });

  it('anchors the visual center of the navigation marker on the route coordinate', () => {
    const internals = renderer as unknown as {
      providerMarkerAnchorTop: (
        marker: TrackingMapRenderState['travelerMarker'],
      ) => string;
    };

    expect(internals.providerMarkerAnchorTop(routeState.travelerMarker)).toBe('-50%');
  });

  it('renders the navigation arrow normally and the blue dot only while recalculating', () => {
    const internals = renderer as unknown as {
      travelerMarkerVisual: (
        marker: TrackingMapRenderState['travelerMarker'],
        routeCalculating?: boolean,
      ) => HTMLElement;
    };

    const arrow = internals.travelerMarkerVisual(routeState.travelerMarker);
    const marker = internals.travelerMarkerVisual(routeState.travelerMarker, true);
    const dot = marker.querySelector<HTMLElement>('.jokko-tracking-navigation-dot-core');

    expect(arrow.className).toBe('jokko-tracking-navigation-arrow');
    expect(arrow.querySelector('svg path')).not.toBeNull();
    expect(arrow.style.backgroundColor).toBe('rgb(255, 255, 255)');
    expect(arrow.style.overflow).toBe('hidden');
    expect(marker.className).toBe('jokko-tracking-navigation-dot');
    expect(marker.style.backgroundColor).toBe('rgba(134, 82, 33, 0.22)');
    expect(dot).not.toBeNull();
    expect(dot?.style.backgroundColor).toBe('rgb(134, 82, 33)');
    expect(dot?.style.border).toContain('3px solid rgb(255, 255, 255)');
  });

  it('keeps the destination pointer as the bottom-most element when a person is shown', () => {
    const internals = renderer as unknown as {
      destinationMarkerContent: (marker: TrackingMapRenderState['destinationMarker']) => HTMLElement;
    };
    const content = internals.destinationMarkerContent({
      ...routeState.destinationMarker,
      person: {
        imageUrl: null,
        initials: 'MN',
        name: 'Prestataire',
        label: 'Prestataire',
        badgeAccent: 'red',
      },
    });

    expect(content.children).toHaveLength(3);
    expect(content.lastElementChild?.className).toBe('jokko-tracking-arrival-pointer');
  });

  it('renders the main route and clickable alternatives with distinct Google Maps-like styles', () => {
    const created: FakePolyline[] = [];
    class FakePolyline {
      options: Record<string, unknown>;
      listeners = new Map<string, () => void>();

      constructor(options: Record<string, unknown>) {
        this.options = options;
        created.push(this);
      }

      setMap(): void {}
      setPath(): void {}
      setOptions(options: Record<string, unknown>): void {
        this.options = options;
      }
      addListener(eventName: string, handler: () => void): void {
        this.listeners.set(eventName, handler);
      }
    }
    const selectedRoutes: string[] = [];
    const internals = renderer as unknown as Record<string, unknown>;
    internals['google'] = {
      maps: {
        Polyline: FakePolyline,
        event: { clearInstanceListeners: () => undefined },
      },
    };
    internals['routeMap'] = {};
    internals['routeSelected'] = (routeId: string) => selectedRoutes.push(routeId);

    (
      internals['renderRoutes'] as (routes: TrackingMapRenderState['routes']) => void
    )([
      ...routeState.routes,
      {
        id: 'alternative-route',
        selected: false,
        coordinates: [
          { lat: 0.001, lng: 0 },
          { lat: 0.001, lng: 0.02 },
        ],
      },
    ]);

    expect(created).toHaveLength(4);
    expect(created[0]?.options['strokeColor']).toBe('#0d8f65');
    expect(created[0]?.options['zIndex']).toBe(19);
    expect(created[1]?.options['strokeColor']).toBe('#1eb980');
    expect(created[1]?.options['strokeOpacity']).toBe(1);
    expect(created[1]?.options['zIndex']).toBe(20);
    expect(created[3]?.options['strokeColor']).toBe('#86dcb8');
    expect(created[3]?.options['strokeOpacity']).toBe(0.62);
    expect(created[3]?.options['zIndex']).toBe(10);
    expect(created[3]?.options['clickable']).toBe(true);

    created[3]?.listeners.get('click')?.();
    expect(selectedRoutes).toEqual(['alternative-route']);
  });

  it('keeps heading aligned with the selected route while moving', () => {
    const internals = renderer as unknown as Record<string, unknown>;
    internals['lastProviderPosition'] = { lat: -0.0001, lng: 0.005 };
    internals['currentTravelerHeading'] = 0;

    const heading = (
      internals['resolveHeading'] as (
        position: GoogleMapsPoint,
        state: TrackingMapRenderState,
      ) => number
    )(
      { lat: 0, lng: 0.005 },
      { ...routeState, headingDegrees: 0, speedKmh: 50 },
    );

    expect(heading).toBeCloseTo(84.6, 5);
  });

  it('keeps prediction active for normal jitter then fades after 500 ms overdue', () => {
    const internals = renderer as unknown as {
      lastMarkerGpsReceivedAt: number;
      markerExpectedGpsIntervalMs: number;
      markerAccuracyMeters: number | null;
      markerPredictionFactor: (timestamp: number) => number;
      cameraMotionDuration: (updateIntervalMs: number) => number;
    };

    internals.lastMarkerGpsReceivedAt = 0;
    internals.markerExpectedGpsIntervalMs = 1_000;
    internals.markerAccuracyMeters = 8;
    expect(internals.markerPredictionFactor(1_000)).toBe(1);
    expect(internals.markerPredictionFactor(1_250)).toBe(1);
    expect(internals.markerPredictionFactor(1_375)).toBeCloseTo(0.5, 5);
    expect(internals.markerPredictionFactor(1_500)).toBe(0);
    expect(internals.markerPredictionFactor(2_000)).toBe(0);
    expect(internals.cameraMotionDuration(1_000)).toBe(950);
  });

  it('moves monotonically along a 90-degree route without cutting the corner', () => {
    const internals = renderer as unknown as {
      pointAlongRouteAtDistance: (
        route: GoogleMapsPoint[],
        distanceMeters: number,
      ) => GoogleMapsPoint | null;
    };
    const route = [
      { lat: 0, lng: 0 },
      { lat: 0, lng: 0.001 },
      { lat: 0.001, lng: 0.001 },
    ];
    const points = [40, 100, 140, 190].map((distance) =>
      internals.pointAlongRouteAtDistance(route, distance),
    );

    expect(points.every((point) => point !== null)).toBe(true);
    expect(points[0]?.lat).toBeCloseTo(0, 7);
    expect(points[0]?.lng).toBeGreaterThan(0);
    expect(points[2]?.lng).toBeCloseTo(0.001, 6);
    expect(points[3]?.lat).toBeGreaterThan(points[2]?.lat ?? Number.POSITIVE_INFINITY);
  });

  it('keeps constant positional speed through the final animation frame', () => {
    const internals = renderer as unknown as {
      linearMotionProgress: (elapsedMs: number, durationMs: number) => number;
    };
    const samples = [0, 225, 450, 675, 900].map((elapsed) =>
      internals.linearMotionProgress(elapsed, 900),
    );
    const increments = samples.slice(1).map((value, index) => value - samples[index]);

    expect(samples).toEqual([0, 0.25, 0.5, 0.75, 1]);
    expect(increments.every((increment) => increment === 0.25)).toBe(true);
  });

  it('never regresses matched progress on the same route', () => {
    const internals = renderer as unknown as {
      monotonicRouteProgress: (previousMeters: number, candidateMeters: number) => number;
    };

    expect(internals.monotonicRouteProgress(128, 124)).toBe(128);
    expect(internals.monotonicRouteProgress(128, 132)).toBe(132);
  });

  it('keeps one RAF alive and updates its target during movement', () => {
    const frames: FrameRequestCallback[] = [];
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      frames.push(callback);
      return frames.length;
    });
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    let clock = 0;
    const route = {
      ...routeState.routes[0],
      coordinates: [
        { lat: 0, lng: 0 },
        { lat: 0, lng: 0.003 },
      ],
    };
    const marker = {
      position: { lat: 0, lng: 0 },
      content: document.createElement('div'),
    };
    const internals = renderer as unknown as Record<string, unknown>;
    internals['animationClock'] = () => clock;
    const animateMarker = (internals['animateMarker'] as (
      markerArg: typeof marker,
      destination: GoogleMapsPoint,
      heading: number,
      speedKmh: number,
      accuracyMeters: number,
      timestamp: number,
      routeArg: typeof route,
    ) => void).bind(renderer);
    const projectPointToRoute = (internals['projectPointToRoute'] as (
      point: GoogleMapsPoint,
      route: GoogleMapsPoint[],
    ) => { distanceAlongRouteMeters: number } | null).bind(renderer);

    animateMarker(marker, { lat: 0, lng: 0.001 }, 90, 50, 8, 1_000, route);
    expect(frames).toHaveLength(1);
    frames.shift()?.(0);
    frames.shift()?.(450);
    const displayedBeforeUpdate = { ...(marker.position as GoogleMapsPoint) };
    const originProgress = projectPointToRoute(displayedBeforeUpdate, route.coordinates)
      ?.distanceAlongRouteMeters as number;

    clock = 1_000;
    animateMarker(marker, { lat: 0, lng: 0.002 }, 90, 50, 8, 2_000, route);
    expect(frames).toHaveLength(1);
    frames.shift()?.(900);
    const progressAfterUpdate = projectPointToRoute(
      marker.position as GoogleMapsPoint,
      route.coordinates,
    )?.distanceAlongRouteMeters as number;

    expect(progressAfterUpdate).toBeGreaterThan(originProgress);
    expect(frames).toHaveLength(1);
    vi.unstubAllGlobals();
  });

  it.each([50, 85, 130])('maintains positive continuous velocity at %i km/h', (speedKmh) => {
    const internals = renderer as unknown as Record<string, unknown>;
    internals['markerMotionMarker'] = {
      position: { lat: 0, lng: 0 },
      content: document.createElement('div'),
    };
    internals['markerRouteCoordinates'] = routeState.routes[0].coordinates;
    internals['renderedRouteProgressMeters'] = 20;
    internals['targetRouteProgressMeters'] = 60;
    internals['currentMarkerVelocityMps'] = speedKmh / 3.6;
    internals['targetMarkerVelocityMps'] = speedKmh / 3.6;
    internals['lastMarkerFrameTimestamp'] = 0;
    internals['lastMarkerGpsReceivedAt'] = 0;
    internals['markerExpectedGpsIntervalMs'] = 1_000;
    internals['markerTargetHeading'] = 90;
    internals['markerAccuracyMeters'] = 8;
    vi.stubGlobal('requestAnimationFrame', vi.fn(() => 1));

    (internals['runContinuousMarkerFrame'] as (timestamp: number) => void).call(renderer, 16);

    expect(internals['currentMarkerVelocityMps'] as number).toBeGreaterThan(0);
    expect(internals['renderedRouteProgressMeters'] as number).toBeGreaterThan(20);
    vi.unstubAllGlobals();
  });

  it('never inserts a zero-speed frame for 900/1100/1250 ms GPS jitter', () => {
    const internals = renderer as unknown as Record<string, unknown>;
    internals['lastMarkerGpsReceivedAt'] = 0;
    internals['markerExpectedGpsIntervalMs'] = 1_000;
    internals['markerAccuracyMeters'] = 8;
    const factor = (timestamp: number) =>
      (internals['markerPredictionFactor'] as (value: number) => number).call(renderer, timestamp);

    expect([900, 1_100, 1_250].map(factor).every((value) => value > 0)).toBe(true);
  });

  it('reduces prediction when GPS accuracy is poor', () => {
    const internals = renderer as unknown as Record<string, unknown>;
    internals['lastMarkerGpsReceivedAt'] = 0;
    internals['markerExpectedGpsIntervalMs'] = 1_000;
    internals['markerAccuracyMeters'] = 90;
    const factor = (internals['markerPredictionFactor'] as (value: number) => number).call(
      renderer,
      1_100,
    );

    expect(factor).toBeCloseTo(0.5, 5);
  });

  it('rotates through the shortest path from 359 to 1 degrees', () => {
    expect(shortestAngleDelta(359, 1)).toBe(2);
  });

  it('prefers route continuity over a nearby parallel segment', () => {
    const internals = renderer as unknown as {
      projectPointToRoute: (
        point: GoogleMapsPoint,
        route: GoogleMapsPoint[],
        preferredProgress: number | null,
        preferredSegment: number | null,
      ) => { segmentIndex: number; distanceAlongRouteMeters: number } | null;
    };
    const closeParallelRoute = [
      { lat: 0, lng: 0 },
      { lat: 0, lng: 0.001 },
      { lat: 0.00005, lng: 0.001 },
      { lat: 0.00005, lng: 0 },
    ];

    const matched = internals.projectPointToRoute(
      { lat: 0.00003, lng: 0.0008 },
      closeParallelRoute,
      80,
      0,
    );

    expect(matched?.segmentIndex).toBe(0);
    expect(matched?.distanceAlongRouteMeters).toBeGreaterThanOrEqual(80);
  });

  it('remaps the displayed position on a new polyline without resetting velocity', () => {
    const frames: FrameRequestCallback[] = [];
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      frames.push(callback);
      return frames.length;
    });
    const marker = {
      position: { lat: 0, lng: 0.001 },
      content: document.createElement('div'),
    };
    const internals = renderer as unknown as Record<string, unknown>;
    internals['renderedRouteProgressKey'] = 'old-route';
    internals['renderedRouteProgressMeters'] = 100;
    internals['currentMarkerVelocityMps'] = 12;
    const animateMarker = (internals['animateMarker'] as Function).bind(renderer);
    const newRoute = {
      id: 'new-route',
      selected: true,
      coordinates: [
        { lat: 0, lng: 0 },
        { lat: 0.00002, lng: 0.001 },
        { lat: 0.00002, lng: 0.003 },
      ],
    };

    animateMarker(marker, { lat: 0.00002, lng: 0.0015 }, 90, 50, 8, 2_000, newRoute);

    expect(internals['currentMarkerVelocityMps']).toBe(12);
    expect(internals['renderedRouteProgressKey']).not.toBe('old-route');
    expect(frames).toHaveLength(1);
    vi.unstubAllGlobals();
  });

  it('keeps one continuous camera RAF while targets change', () => {
    const frames: FrameRequestCallback[] = [];
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      frames.push(callback);
      return frames.length;
    });
    const internals = renderer as unknown as Record<string, unknown>;
    internals['routeMap'] = { moveCamera: vi.fn() };
    internals['renderedCameraCenter'] = { lat: 0, lng: 0 };
    const follow = (internals['animateFollowCamera'] as Function).bind(renderer);

    follow({ lat: 0, lng: 0.001 }, 359, 50, 1_000);
    expect(frames).toHaveLength(1);
    follow({ lat: 0, lng: 0.002 }, 1, 50, 2_100);
    expect(frames).toHaveLength(1);
    frames.shift()?.(16);
    expect(frames).toHaveLength(1);
    vi.unstubAllGlobals();
  });

  it('samples a curved route along its polyline instead of a direct chord', () => {
    const internals = renderer as unknown as {
      pointAlongRouteAtDistance: (
        route: GoogleMapsPoint[],
        distanceMeters: number,
      ) => GoogleMapsPoint | null;
    };
    const curvedRoute = [
      { lat: 0, lng: 0 },
      { lat: 0.0003, lng: 0.0007 },
      { lat: 0.001, lng: 0.001 },
    ];

    const point = internals.pointAlongRouteAtDistance(curvedRoute, 70);
    expect(point).not.toBeNull();
    expect(point?.lng).toBeGreaterThan(point?.lat ?? Number.POSITIVE_INFINITY);
  });
});

type FakePolyline = {
  options: Record<string, unknown>;
  listeners: Map<string, () => void>;
};
