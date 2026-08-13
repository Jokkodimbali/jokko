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

    it('refuses to snap raw GPS that is outside the adaptive route corridor', () => {
      const snap = (internals['snapTravelerMarkerToSelectedRoute'] as (
        point: GoogleMapsPoint,
        state: TrackingMapRenderState,
      ) => GoogleMapsPoint).bind(renderer);
      const raw = { lat: 0.0005, lng: 0.004 };

      const displayed = snap(raw, { ...BASE_STATE, accuracyMeters: 8, speedKmh: 30 });

      expect(displayed).toEqual(raw);
      expect(internals['mapMatchConfidence']).toBe(0);
    });

    it('follows raw GPS instead of the obsolete route while REROUTING', () => {
      const snap = (internals['snapTravelerMarkerToSelectedRoute'] as (
        point: GoogleMapsPoint,
        state: TrackingMapRenderState,
      ) => GoogleMapsPoint).bind(renderer);
      const raw = { lat: 0.00008, lng: 0.004 };

      const displayed = snap(raw, { ...BASE_STATE, routeMatchMode: 'REROUTING' });

      expect(displayed).toEqual(raw);
    });

    it('keeps raw GPS and zero route confidence while JOINING_ROUTE', () => {
      const snap = (internals['snapTravelerMarkerToSelectedRoute'] as (
        point: GoogleMapsPoint,
        state: TrackingMapRenderState,
      ) => GoogleMapsPoint).bind(renderer);
      const raw = { lat: 0.00008, lng: 0.004 };
      internals['mapMatchConfidence'] = 1;

      const displayed = snap(raw, { ...BASE_STATE, routeMatchMode: 'JOINING_ROUTE' });

      expect(displayed).toEqual(raw);
      expect(internals['mapMatchConfidence']).toBe(0);
    });

    it('derives confidence from raw lateral error instead of the projected point', () => {
      const snap = (internals['snapTravelerMarkerToSelectedRoute'] as (
        point: GoogleMapsPoint,
        state: TrackingMapRenderState,
      ) => GoogleMapsPoint).bind(renderer);

      snap({ lat: 0.00008, lng: 0.004 }, BASE_STATE);

      expect(internals['mapMatchConfidence']).toBeGreaterThan(0);
      expect(internals['mapMatchConfidence']).toBeLessThan(1);
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
      expect(internals['markerRouteCoordinates']).toEqual(newRoute.coordinates);
      expect(internals['markerFreeTarget']).toBeNull();
    });

    it('follows live GPS continuously while rerouting has no polyline yet', () => {
      const frames: FrameRequestCallback[] = [];
      vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
        frames.push(callback);
        return frames.length;
      });
      const marker = {
        position: { lat: 0, lng: 0 },
        content: document.createElement('div'),
      };
      internals['renderedRouteProgressKey'] = 'obsolete-route';
      internals['renderedRouteProgressMeters'] = 120;
      internals['markerRouteCoordinates'] = STRAIGHT_ROUTE;
      internals['currentMarkerVelocityMps'] = 10;
      const animate = (internals['animateMarker'] as Function).bind(renderer);

      animate(marker, { lat: 0.0002, lng: 0.0001 }, 20, 36, 8, 2_000, null);

      expect(internals['markerRouteCoordinates']).toEqual([]);
      expect(internals['renderedRouteProgressKey']).toBe('');
      expect(internals['markerFreeTarget']).toEqual({ lat: 0.0002, lng: 0.0001 });
      frames.shift()?.(0);
      frames.shift()?.(50);
      expect((marker.position as GoogleMapsPoint).lat).toBeGreaterThan(0);
      expect((marker.position as GoogleMapsPoint).lng).toBeGreaterThan(0);
    });

    it('reattaches immediately to the recalculated route reference', () => {
      const frames: FrameRequestCallback[] = [];
      vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
        frames.push(callback);
        return frames.length;
      });
      const displayed = { lat: 0.00015, lng: 0.0001 };
      const marker = { position: displayed, content: document.createElement('div') };
      internals['markerFreeTarget'] = displayed;
      internals['renderedRouteProgressKey'] = '';
      internals['renderedRouteProgressMeters'] = 0;
      internals['currentMarkerVelocityMps'] = 9;
      const rerouted = {
        id: 'rerouted',
        selected: true,
        coordinates: [
          { lat: 0.0002, lng: 0 },
          { lat: 0.0002, lng: 0.002 },
        ],
      };

      (internals['animateMarker'] as Function).call(
        renderer,
        marker,
        { lat: 0.0002, lng: 0.0003 },
        90,
        36,
        8,
        3_000,
        rerouted,
      );

      expect(marker.position).toEqual(displayed);
      expect(internals['markerRouteCoordinates']).toEqual(rerouted.coordinates);
      expect(internals['markerFreeTarget']).toBeNull();
      expect(internals['currentMarkerVelocityMps']).toBe(9);

      frames.shift()?.(0);
      const before = { ...(marker.position as GoogleMapsPoint) };
      frames.shift()?.(50);
      const after = marker.position as GoogleMapsPoint;
      const movedMeters = (internals['distanceMeters'] as Function).call(
        renderer,
        before,
        after,
      ) as number;
      expect(movedMeters).toBeGreaterThan(0);
      expect(movedMeters).toBeLessThan(2);
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

    it('treats low iPhone speed noise as stationary without real displacement', () => {
      const hold = internals['shouldHoldMarkerPosition'] as (
        movementMeters: number,
        speedKmh: number,
        accuracyMeters: number,
      ) => boolean;

      expect(hold(2, 5, 8)).toBe(true);
      expect(hold(15, 5, 8)).toBe(false);
    });

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
    it('stacks the avatar below the intervention card and the role badge below the avatar', () => {
      const content = (internals['destinationPersonContent'] as Function).call(
        renderer,
        {
          ...BASE_STATE.destinationMarker,
          person: {
            imageUrl: null,
            initials: 'MN',
            name: 'Moustapha',
            label: "Lieu d'intervention",
            badgeAccent: 'blue',
          },
        },
        {
          scale: 1,
          destinationAvatar: 44,
          destinationBadgeFont: 13,
        },
      ) as HTMLElement;

      const [avatar, badge] = Array.from(content.children) as HTMLElement[];
      expect(badge.textContent).toBe("Lieu d'intervention");
      expect(avatar.style.zIndex).toBe('1');
      expect(badge.style.zIndex).toBe('2');
      expect(Number.parseFloat(content.style.marginTop)).toBeLessThan(0);
      expect(Number.parseFloat(badge.style.marginTop)).toBeLessThan(0);
      expect(content.style.isolation).toBe('isolate');

      const completeMarker = (internals['destinationMarkerContent'] as Function).call(
        renderer,
        {
          ...BASE_STATE.destinationMarker,
          person: {
            imageUrl: null,
            initials: 'MN',
            name: 'Moustapha',
            label: 'Plombier',
            badgeAccent: 'blue',
          },
        },
      ) as HTMLElement;
      expect(Array.from(completeMarker.children).map((child) => child.className)).toEqual([
        'jokko-tracking-arrival-card',
        'jokko-tracking-arrival-person',
        'jokko-tracking-arrival-pointer',
      ]);
    });

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

    it('keeps OVERVIEW bounds on the complete route while the visible route is trimmed', () => {
      const rendered = { lat: 0, lng: 0.004 };
      const fittedRoutes: TrackingMapRenderState['routes'][] = [];
      internals['google'] = {};
      internals['routeMap'] = { setOptions: () => undefined };
      internals['topViewEnabled'] = true;
      internals['upsertProviderMarker'] = () => ({ position: rendered });
      internals['upsertDestinationMarker'] = () => undefined;
      internals['renderRoutes'] = () => undefined;
      internals['fitRoute'] = (
        _provider: GoogleMapsPoint,
        _destination: GoogleMapsPoint,
        routes: TrackingMapRenderState['routes'],
      ) => fittedRoutes.push(routes);
      internals['refreshRenderedTravelerMarker'] = () => undefined;

      renderer.render({ ...BASE_STATE, provider: rendered });

      expect(fittedRoutes).toHaveLength(1);
      expect(fittedRoutes[0]?.[0]?.coordinates).toEqual(STRAIGHT_ROUTE);
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

    it('keeps one permanent camera RAF while navigation updates its target', () => {
      const frames: FrameRequestCallback[] = [];
      vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
        frames.push(callback);
        return frames.length;
      });
      const moveCamera = vi.fn();
      internals['routeMap'] = { moveCamera };
      internals['renderedCameraCenter'] = { lat: 0, lng: 0 };
      const follow = (internals['animateFollowCamera'] as Function).bind(renderer);

      follow({ lat: 0, lng: 0.001 }, 359, 50, 1_000);
      follow({ lat: 0, lng: 0.002 }, 1, 50, 2_000);

      expect(frames).toHaveLength(1);
      expect(moveCamera).toHaveBeenCalledTimes(1);
      frames.shift()?.(16);
      expect(moveCamera).toHaveBeenCalledTimes(2);
      expect(frames).toHaveLength(1);
    });

    it('does not let the camera finish an old look-ahead after the vehicle stops', () => {
      vi.stubGlobal('requestAnimationFrame', vi.fn(() => 1));
      internals['routeMap'] = { moveCamera: vi.fn() };
      internals['markerStationary'] = true;
      internals['cameraAnchoredToTraveler'] = true;
      internals['renderedCameraCenter'] = { lat: 0, lng: 0.001 };
      internals['renderedCameraHeading'] = 90;
      internals['renderedCameraZoom'] = 19;
      internals['renderedCameraTilt'] = 63;

      (internals['animateFollowCamera'] as Function).call(
        renderer,
        { lat: 0, lng: 0.01 },
        180,
        0,
        2_000,
      );

      expect(internals['cameraTargetCenter']).toEqual({ lat: 0, lng: 0.001 });
      expect(internals['cameraTargetHeading']).toBe(90);
      expect(internals['cameraTargetZoom']).toBe(19);
      expect(internals['cameraTargetTilt']).toBe(63);
    });

    it('anchors the first shared GPS position even when the traveler is stationary', () => {
      const moveCamera = vi.fn();
      internals['routeMap'] = { moveCamera };
      internals['markerStationary'] = true;
      internals['cameraAnchoredToTraveler'] = false;
      internals['renderedCameraCenter'] = { lat: 14.7167, lng: -17.4677 };
      const departure = { lat: 14.704, lng: -17.478 };

      (internals['animateFollowCamera'] as Function).call(
        renderer,
        departure,
        90,
        0,
        1_000,
      );

      expect(moveCamera).toHaveBeenCalledWith(expect.objectContaining({ center: departure }));
      expect(internals['renderedCameraCenter']).toEqual(departure);
      expect(internals['cameraAnchoredToTraveler']).toBe(true);
    });

    it('applies heading directly without starting a scrolling RAF', () => {
      const frames: FrameRequestCallback[] = [];
      const cancel = vi.fn();
      vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
        frames.push(callback);
        return frames.length;
      });
      vi.stubGlobal('cancelAnimationFrame', cancel);
      internals['routeMap'] = {
        setOptions: vi.fn(),
        moveCamera: vi.fn(),
        getCenter: () => ({ lat: () => 0, lng: () => 0 }),
      };
      internals['renderedCameraCenter'] = { lat: 0, lng: 0 };
      internals['cameraTargetCenter'] = { lat: 0, lng: 0 };

      renderer.setHeading(90);
      renderer.setHeading(135);

      expect(cancel).not.toHaveBeenCalled();
      expect(frames).toHaveLength(0);
      expect(internals['cameraTargetHeading']).toBe(135);
    });

    it('preserves a user-selected zoom in navigation view', () => {
      internals['userCameraZoom'] = 16.25;
      const zoom = (internals['cameraZoom'] as () => number).bind(renderer);
      expect(zoom()).toBe(16.25);
    });

    it('drops the global bounds center before entering driver view', () => {
      const moveCamera = vi.fn();
      internals['topViewEnabled'] = true;
      internals['renderedCameraCenter'] = { lat: 14.7, lng: -17.5 };
      internals['cameraTargetCenter'] = { lat: 14.7, lng: -17.5 };
      internals['routeMap'] = {
        setOptions: vi.fn(),
        setHeading: vi.fn(),
        setTilt: vi.fn(),
        moveCamera,
      };

      renderer.setTopView(false);

      expect(internals['renderedCameraCenter']).toBeNull();
      expect(internals['cameraTargetCenter']).toBeNull();
      expect(moveCamera).not.toHaveBeenCalled();
    });

    it('does not confuse an automatic RAF zoom frame with a user zoom', () => {
      internals['cameraTargetZoom'] = 20.4;
      internals['renderedCameraZoom'] = 20.35;
      const shouldCapture = (internals['shouldCaptureUserZoom'] as (zoom: number) => boolean).bind(
        renderer,
      );

      expect(shouldCapture(20.4)).toBe(false);
      expect(shouldCapture(20.35)).toBe(false);
      expect(shouldCapture(18)).toBe(true);
    });

    it('aligns a stationary driver view with a confidently matched route', () => {
      vi.stubGlobal('requestAnimationFrame', vi.fn(() => 1));
      internals['routeMap'] = { moveCamera: vi.fn() };
      internals['markerStationary'] = true;
      internals['cameraAnchoredToTraveler'] = true;
      internals['mapMatchConfidence'] = 0.95;
      internals['renderedCameraCenter'] = { lat: 0, lng: 0 };
      internals['renderedCameraHeading'] = 0;

      (internals['animateFollowCamera'] as Function).call(
        renderer,
        { lat: 0, lng: 0.01 },
        90,
        0,
        2_000,
      );

      expect(internals['cameraTargetCenter']).toEqual({ lat: 0, lng: 0 });
      expect(internals['cameraTargetHeading']).toBe(90);
    });

    it('enters FREE after a gesture and ignores subsequent GPS camera targets', () => {
      internals['renderedCameraCenter'] = { lat: 0, lng: 0 };
      internals['cameraTargetCenter'] = { lat: 0, lng: 0 };
      internals['routeMap'] = { moveCamera: vi.fn() };

      (internals['enterFreeCameraMode'] as Function).call(renderer);
      (internals['animateFollowCamera'] as Function).call(
        renderer,
        { lat: 0, lng: 0.01 },
        90,
        50,
        2_000,
      );

      expect(renderer.getCameraMode()).toBe('FREE');
      expect(internals['cameraTargetCenter']).toEqual({ lat: 0, lng: 0 });
      expect((internals['routeMap'] as { moveCamera: ReturnType<typeof vi.fn> }).moveCamera)
        .not.toHaveBeenCalled();
    });

    it('transitions RECENTERING to FOLLOWING after converging without a jump', () => {
      const frames: FrameRequestCallback[] = [];
      vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
        frames.push(callback);
        return frames.length;
      });
      internals['cameraMode'] = 'FREE';
      internals['routeMap'] = { moveCamera: vi.fn() };
      internals['renderedCameraCenter'] = { lat: 0, lng: 0.001 };
      internals['cameraTargetCenter'] = { lat: 0, lng: 0.001 };
      internals['renderedCameraHeading'] = 90;
      internals['cameraTargetHeading'] = 90;
      internals['cameraAnchoredToTraveler'] = true;

      renderer.recenterNavigationCamera();
      internals['cameraTargetCenter'] = { lat: 0, lng: 0.001 };
      internals['cameraAnchoredToTraveler'] = true;
      (internals['ensureContinuousCameraLoop'] as Function).call(renderer);
      frames.shift()?.(16);

      expect(renderer.getCameraMode()).toBe('FOLLOWING');
    });

    it('exposes explicit OVERVIEW and ARRIVAL camera states', () => {
      internals['routeMap'] = {
        setOptions: vi.fn(),
        setHeading: vi.fn(),
        setTilt: vi.fn(),
        moveCamera: vi.fn(),
      };

      renderer.setTopView(true);
      expect(renderer.getCameraMode()).toBe('OVERVIEW');
      (internals['updateCameraModeForRender'] as Function).call(renderer, true);
      expect(renderer.getCameraMode()).toBe('ARRIVAL');
    });

    it('damps camera frames monotonically at irregular 16/33/48 ms cadence', () => {
      const frames: FrameRequestCallback[] = [];
      const centers: GoogleMapsPoint[] = [];
      vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
        frames.push(callback);
        return frames.length;
      });
      internals['routeMap'] = {
        moveCamera: ({ center }: { center: GoogleMapsPoint }) => centers.push(center),
      };
      internals['cameraMode'] = 'FOLLOWING';
      internals['renderedCameraCenter'] = { lat: 0, lng: 0 };
      internals['cameraTargetCenter'] = { lat: 0, lng: 0.001 };
      internals['renderedCameraHeading'] = 359;
      internals['cameraTargetHeading'] = 1;
      internals['cameraTargetSpeedKmh'] = 50;

      (internals['ensureContinuousCameraLoop'] as Function).call(renderer);
      for (const timestamp of [16, 49, 97]) frames.shift()?.(timestamp);

      expect(centers.map((center) => center.lng)).toEqual(
        [...centers.map((center) => center.lng)].sort((a, b) => a - b),
      );
      expect(centers.every((center) => center.lng <= 0.001)).toBe(true);
      expect(internals['renderedCameraHeading']).toBeGreaterThan(359);
    });

    it('keeps the existing camera look-ahead while following free GPS during rerouting', () => {
      const marker = { position: { lat: 0, lng: 0 }, content: document.createElement('div') };
      internals['markerFreeTarget'] = { lat: 0, lng: 0.001 };
      internals['cameraTargetCenter'] = { lat: 0.001, lng: 0 };
      internals['targetMarkerVelocityMps'] = 15;
      internals['currentMarkerVelocityMps'] = 15;
      internals['lastMarkerGpsReceivedAt'] = 0;
      internals['markerExpectedGpsIntervalMs'] = 1_000;
      internals['markerStationary'] = false;
      internals['topViewEnabled'] = false;

      (internals['runFreeMarkerFrame'] as Function).call(renderer, marker, 0.05, 50);

      const movedMarker = marker.position as GoogleMapsPoint;
      const cameraTarget = internals['cameraTargetCenter'] as GoogleMapsPoint;
      expect(movedMarker.lng).toBeGreaterThan(0);
      expect(cameraTarget.lat).toBeCloseTo(0.001, 8);
      expect(cameraTarget.lng).toBeCloseTo(movedMarker.lng, 8);
    });

    it('never advances the camera look-ahead while the vehicle is stationary', () => {
      internals['topViewEnabled'] = false;
      internals['markerStationary'] = true;
      internals['renderedCameraCenter'] = { lat: 0, lng: 0.001 };
      internals['cameraTargetCenter'] = { lat: 0, lng: 0.004 };
      internals['navigationCameraDecision'] = { lookAheadMeters: 80 };
      internals['markerRouteCoordinates'] = STRAIGHT_ROUTE;

      (internals['synchronizeRouteAndCameraWithMarker'] as Function).call(
        renderer,
        { lat: 0, lng: 0.001 },
        100,
      );

      expect(internals['cameraTargetCenter']).toEqual({ lat: 0, lng: 0.001 });
    });

    it('bounds a large camera recentering instead of crossing it in one frame', () => {
      internals['cameraTargetSpeedKmh'] = 50;
      const boundedStep = (internals['boundedCameraCenterStep'] as Function).call(
        renderer,
        { lat: 0, lng: 0 },
        { lat: 0, lng: 0.01 },
        1,
        0.05,
      ) as GoogleMapsPoint;

      expect(boundedStep.lng).toBeGreaterThan(0);
      expect(boundedStep.lng).toBeLessThan(0.001);
    });
  });
});

type FakePolyline = {
  options: Record<string, unknown>;
  listeners: Map<string, () => void>;
};
