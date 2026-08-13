import { TestBed } from '@angular/core/testing';
import {
  GoogleMapsLoaderService,
  GoogleMapsPoint,
} from '../../../shared/maps/google-maps-loader.service';
import {
  TrackingGoogleMapRendererService,
  TrackingMapRenderState,
} from './tracking-google-map-renderer.service';

const STRAIGHT_ROUTE: GoogleMapsPoint[] = [
  { lat: 0, lng: 0 },
  { lat: 0, lng: 0.01 },
];

const BASE_STATE: TrackingMapRenderState = {
  provider: STRAIGHT_ROUTE[0],
  destination: STRAIGHT_ROUTE[1],
  routes: [{ id: 'main', selected: true, coordinates: STRAIGHT_ROUTE }],
  destinationMarker: { title: 'Destination', subtitle: '', etaLabel: '2 min', accent: 'blue' },
  remainingLabel: '2 min',
  statusLabel: 'En route',
  headingDegrees: 90,
  speedKmh: 50,
  accuracyMeters: 8,
  arrived: false,
  travelerMarker: {
    kind: 'navigation',
    imageUrl: null,
    initials: 'JK',
    name: 'Navigation',
    roleLabel: 'En route',
  },
};

describe('TrackingGoogleMapRendererService - deterministic navigation contracts', () => {
  let renderer: TrackingGoogleMapRendererService;
  let internals: Record<string, unknown>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        TrackingGoogleMapRendererService,
        { provide: GoogleMapsLoaderService, useValue: {} },
      ],
    });
    renderer = TestBed.inject(TrackingGoogleMapRendererService);
    internals = renderer as unknown as Record<string, unknown>;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  describe('road matching and metric progression', () => {
    it('snaps lateral GPS error exactly onto the selected route', () => {
      const snap = (internals['snapTravelerMarkerToSelectedRoute'] as (
        point: GoogleMapsPoint,
        state: TrackingMapRenderState,
      ) => GoogleMapsPoint).bind(renderer);

      const snapped = snap({ lat: 0.00008, lng: 0.004 }, BASE_STATE);

      expect(snapped.lat).toBeCloseTo(0, 8);
      expect(snapped.lng).toBeCloseTo(0.004, 8);
    });

    it('keeps curved-route samples on an actual segment instead of cutting the corner', () => {
      const pointAt = (internals['pointAlongRouteAtDistance'] as (
        route: GoogleMapsPoint[],
        meters: number,
      ) => GoogleMapsPoint | null).bind(renderer);
      const route = [
        { lat: 0, lng: 0 },
        { lat: 0, lng: 0.001 },
        { lat: 0.001, lng: 0.001 },
      ];
      const points = [40, 100, 140, 190].map((meters) => pointAt(route, meters));

      expect(points.every(Boolean)).toBe(true);
      expect(points[0]?.lat).toBeCloseTo(0, 8);
      expect(points[2]?.lng).toBeCloseTo(0.001, 6);
      expect(points[3]?.lat).toBeGreaterThan(points[2]?.lat ?? Number.POSITIVE_INFINITY);
    });

    it('never allows distanceAlongRoute to regress', () => {
      const monotonic = internals['monotonicRouteProgress'] as (
        previous: number,
        candidate: number,
      ) => number;

      expect(monotonic(120, 118)).toBe(120);
      expect(monotonic(120, 126)).toBe(126);
    });

    it('prefers segment continuity on nearby parallel roads', () => {
      const project = (internals['projectPointToRoute'] as (
        point: GoogleMapsPoint,
        route: GoogleMapsPoint[],
        preferredProgress: number | null,
        preferredSegment: number | null,
      ) => { segmentIndex: number; distanceAlongRouteMeters: number } | null).bind(renderer);
      const parallel = [
        { lat: 0, lng: 0 },
        { lat: 0, lng: 0.001 },
        { lat: 0.00005, lng: 0.001 },
        { lat: 0.00005, lng: 0 },
      ];

      const matched = project({ lat: 0.00003, lng: 0.0008 }, parallel, 80, 0);

      expect(matched?.segmentIndex).toBe(0);
      expect(matched?.distanceAlongRouteMeters).toBeGreaterThanOrEqual(80);
    });

    it('remaps onto a new polyline without resetting current visual velocity', () => {
      vi.stubGlobal('requestAnimationFrame', vi.fn(() => 1));
      const marker = { position: { lat: 0, lng: 0.001 }, content: document.createElement('div') };
      internals['renderedRouteProgressKey'] = 'old';
      internals['renderedRouteProgressMeters'] = 100;
      internals['currentMarkerVelocityMps'] = 12;
      const animate = (internals['animateMarker'] as Function).bind(renderer);
      const newRoute = {
        id: 'rerouted',
        selected: true,
        coordinates: [
          { lat: 0, lng: 0 },
          { lat: 0.00002, lng: 0.001 },
          { lat: 0.00002, lng: 0.003 },
        ],
      };

      animate(marker, { lat: 0.00002, lng: 0.0015 }, 90, 50, 8, 2_000, newRoute);

      expect(internals['currentMarkerVelocityMps']).toBe(12);
      expect(internals['renderedRouteProgressKey']).not.toBe('old');
    });
  });

  describe('stationary GPS and prediction', () => {
    it.each([
      [18, 0, 12, true],
      [5, null, 10, true],
      [20, 20, 12, false],
      [60, null, 80, true],
    ])(
      'evaluates movement=%s speed=%s accuracy=%s as hold=%s',
      (movement, speed, accuracy, expected) => {
        const hold = internals['shouldHoldMarkerPosition'] as (
          movementMeters: number,
          speedKmh: number | null,
          accuracyMeters: number | null,
        ) => boolean;
        expect(hold(movement as number, speed as number | null, accuracy as number)).toBe(expected);
      },
    );

    it('predicts normally, fades between 250 and 500 ms overdue, then stops', () => {
      internals['lastMarkerGpsReceivedAt'] = 0;
      internals['markerExpectedGpsIntervalMs'] = 1_000;
      internals['markerAccuracyMeters'] = 8;
      internals['markerStationary'] = false;
      const factor = (internals['markerPredictionFactor'] as (timestamp: number) => number)
        .bind(renderer);

      expect(factor(1_250)).toBe(1);
      expect(factor(1_375)).toBeCloseTo(0.5, 6);
      expect(factor(1_500)).toBe(0);
    });

    it('disables prediction for stationary or inaccurate GPS', () => {
      internals['lastMarkerGpsReceivedAt'] = 0;
      internals['markerExpectedGpsIntervalMs'] = 1_000;
      internals['markerAccuracyMeters'] = 90;
      internals['markerStationary'] = false;
      const factor = (internals['markerPredictionFactor'] as (timestamp: number) => number)
        .bind(renderer);
      expect(factor(1_100)).toBe(0);

      internals['markerAccuracyMeters'] = 8;
      internals['markerStationary'] = true;
      expect(factor(1_100)).toBe(0);
    });

    it.each([4.5, 20, 50, 85, 130])(
      'maintains positive RAF velocity at %i km/h',
      (speedKmh) => {
        internals['markerMotionMarker'] = {
          position: STRAIGHT_ROUTE[0],
          content: document.createElement('div'),
        };
        internals['markerRouteCoordinates'] = STRAIGHT_ROUTE;
        internals['renderedRouteProgressMeters'] = 20;
        internals['targetRouteProgressMeters'] = 80;
        internals['currentMarkerVelocityMps'] = speedKmh / 3.6;
        internals['targetMarkerVelocityMps'] = speedKmh / 3.6;
        internals['lastMarkerFrameTimestamp'] = 0;
        internals['lastMarkerGpsReceivedAt'] = 0;
        internals['markerExpectedGpsIntervalMs'] = 1_000;
        internals['markerTargetHeading'] = 90;
        internals['markerAccuracyMeters'] = 8;
        internals['markerStationary'] = false;
        vi.stubGlobal('requestAnimationFrame', vi.fn(() => 1));

        (internals['runContinuousMarkerFrame'] as (timestamp: number) => void)(50);

        expect(internals['currentMarkerVelocityMps'] as number).toBeGreaterThan(0);
        expect(internals['renderedRouteProgressMeters'] as number).toBeGreaterThan(20);
      },
    );
  });

  describe('route-marker visual coherence', () => {
    it('starts the visible selected route at the marker actually rendered by RAF', () => {
      const target = { lat: 0, lng: 0.008 };
      const rendered = { lat: 0, lng: 0.004 };
      const anchors: GoogleMapsPoint[] = [];
      internals['google'] = {};
      internals['routeMap'] = { setOptions: () => undefined };
      internals['upsertProviderMarker'] = () => ({ position: rendered });
      internals['upsertDestinationMarker'] = () => undefined;
      internals['routesStartingAtProvider'] = (provider: GoogleMapsPoint) => {
        anchors.push(provider);
        return [];
      };
      internals['renderRoutes'] = () => undefined;
      internals['fitRoute'] = () => undefined;
      internals['refreshRenderedTravelerMarker'] = () => undefined;

      renderer.render({ ...BASE_STATE, provider: target });

      expect(anchors).toEqual([rendered]);
    });

    it('erases the traveled route at exactly the marker metric progress', () => {
      const outlineSetPath = vi.fn();
      const routeSetPath = vi.fn();
      internals['markerRouteCoordinates'] = STRAIGHT_ROUTE;
      internals['selectedRoutePolylineIndex'] = 0;
      internals['routeOutlinePolylines'] = [{ setPath: outlineSetPath }];
      internals['routePolylines'] = [{ setPath: routeSetPath }];
      internals['topViewEnabled'] = true;
      const distance = (internals['distanceMeters'] as (
        from: GoogleMapsPoint,
        to: GoogleMapsPoint,
      ) => number)(STRAIGHT_ROUTE[0], STRAIGHT_ROUTE[1]);
      const marker = { lat: 0, lng: 0.005 };

      (internals['synchronizeRouteAndCameraWithMarker'] as (
        point: GoogleMapsPoint,
        progress: number,
      ) => void)(marker, distance / 2);

      const remaining = routeSetPath.mock.calls[0]?.[0] as GoogleMapsPoint[];
      expect(outlineSetPath).toHaveBeenCalledTimes(1);
      expect(remaining[0]?.lat).toBeCloseTo(marker.lat, 8);
      expect(remaining[0]?.lng).toBeCloseTo(marker.lng, 8);
    });

    it('shows alternatives only to the traveler', () => {
      const alternative = {
        id: 'alternative',
        selected: false,
        coordinates: [
          { lat: 0.001, lng: 0 },
          { lat: 0.001, lng: 0.01 },
        ],
      };
      const routes = [...BASE_STATE.routes, alternative];
      const allowed = internals['routesAllowedForViewer'] as (
        state: TrackingMapRenderState,
      ) => TrackingMapRenderState['routes'];

      expect(allowed({ ...BASE_STATE, routes, showAlternativeRoutes: false })).toEqual(
        BASE_STATE.routes,
      );
      expect(allowed({ ...BASE_STATE, routes, showAlternativeRoutes: true })).toEqual(routes);
    });

    it('renders a selected corridor above clickable light alternatives', () => {
      const created: FakePolyline[] = [];
      const selected: string[] = [];
      class Polyline implements FakePolyline {
        options: Record<string, unknown>;
        listeners = new Map<string, () => void>();
        constructor(options: Record<string, unknown>) {
          this.options = options;
          created.push(this);
        }
        setMap(): void {}
        setPath(): void {}
        setOptions(options: Record<string, unknown>): void { this.options = options; }
        addListener(name: string, handler: () => void): void { this.listeners.set(name, handler); }
      }
      internals['google'] = {
        maps: { Polyline, event: { clearInstanceListeners: () => undefined } },
      };
      internals['routeMap'] = {};
      internals['routeSelected'] = (id: string) => selected.push(id);
      const renderRoutes = (internals['renderRoutes'] as (
        routes: TrackingMapRenderState['routes'],
      ) => void).bind(renderer);

      renderRoutes([
        ...BASE_STATE.routes,
        {
          id: 'alternative',
          selected: false,
          coordinates: [{ lat: 0.001, lng: 0 }, { lat: 0.001, lng: 0.01 }],
        },
      ]);

      expect(created).toHaveLength(4);
      expect(created[1]?.options['zIndex']).toBe(20);
      expect(created[3]?.options['zIndex']).toBe(10);
      expect(created[3]?.options['strokeOpacity']).toBeLessThan(1);
      created[3]?.listeners.get('click')?.();
      expect(selected).toEqual(['alternative']);
    });
  });

  describe('continuous marker and camera loops', () => {
    it('keeps one marker RAF while a newer GPS target arrives', () => {
      const frames: FrameRequestCallback[] = [];
      vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
        frames.push(callback);
        return frames.length;
      });
      vi.stubGlobal('cancelAnimationFrame', vi.fn());
      let clock = 0;
      internals['animationClock'] = () => clock;
      const marker = { position: STRAIGHT_ROUTE[0], content: document.createElement('div') };
      const animate = (internals['animateMarker'] as Function).bind(renderer);
      const route = BASE_STATE.routes[0];

      animate(marker, { lat: 0, lng: 0.002 }, 90, 50, 8, 1_000, route);
      expect(frames).toHaveLength(1);
      frames.shift()?.(0);
      clock = 1_000;
      animate(marker, { lat: 0, lng: 0.004 }, 90, 50, 8, 2_000, route);

      expect(frames).toHaveLength(1);
      frames.shift()?.(50);
      expect((marker.position as GoogleMapsPoint).lng).toBeGreaterThan(0);
      expect(frames).toHaveLength(1);
    });

    it('keeps one camera RAF when camera targets change', () => {
      const frames: FrameRequestCallback[] = [];
      vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
        frames.push(callback);
        return frames.length;
      });
      internals['routeMap'] = { moveCamera: vi.fn() };
      internals['renderedCameraCenter'] = { lat: 0, lng: 0 };
      const follow = (internals['animateFollowCamera'] as Function).bind(renderer);

      follow({ lat: 0, lng: 0.001 }, 359, 50, 1_000);
      follow({ lat: 0, lng: 0.002 }, 1, 50, 2_000);

      expect(frames).toHaveLength(1);
      frames.shift()?.(16);
      expect(frames).toHaveLength(1);
    });

    it('preserves a user-selected zoom in navigation view', () => {
      internals['userCameraZoom'] = 16.25;
      const zoom = (internals['cameraZoom'] as () => number).bind(renderer);
      expect(zoom()).toBe(16.25);
    });

    it('temporarily suspends automatic camera movement after a user gesture', () => {
      vi.stubGlobal('requestAnimationFrame', vi.fn(() => 1));
      internals['routeMap'] = { moveCamera: vi.fn() };
      internals['cameraTargetCenter'] = { lat: 0, lng: 0.01 };
      internals['renderedCameraCenter'] = { lat: 0, lng: 0 };
      internals['cameraFollowSuspendedUntil'] = 5_000;
      internals['topViewEnabled'] = false;

      (internals['runContinuousCameraFrame'] as (timestamp: number) => void)(1_000);

      expect((internals['routeMap'] as { moveCamera: ReturnType<typeof vi.fn> }).moveCamera)
        .not.toHaveBeenCalled();
    });
  });
});

type FakePolyline = {
  options: Record<string, unknown>;
  listeners: Map<string, () => void>;
};
