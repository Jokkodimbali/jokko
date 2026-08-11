import { Injectable, inject } from '@angular/core';
import {
  GoogleMapsAdvancedMarkerInstance,
  GoogleMapsLoaderService,
  GoogleMapsMapInstance,
  GoogleMapsOverlayViewInstance,
  GoogleMapsPoint,
  GoogleMapsPolylineInstance,
  GoogleMapsRuntime,
} from '../../../shared/maps/google-maps-loader.service';
import {
  NAVIGATION_CAMERA_CONFIG,
  NavigationCameraDecision,
  NavigationCameraEngine,
  shortestAngleDelta,
} from './navigation-camera.engine';

export type TrackingMapRoute = {
  id: string;
  coordinates: GoogleMapsPoint[];
  selected: boolean;
  navigationSteps?: TrackingMapNavigationStep[];
};

export type TrackingMapNavigationStep = {
  id: string;
  instruction: string;
  maneuver: string | null;
  distanceMeters: number | null;
  start: GoogleMapsPoint | null;
  end: GoogleMapsPoint | null;
};

export type TrackingTravelerMarker = {
  kind: 'avatar' | 'vehicle' | 'navigation';
  imageUrl: string | null;
  initials: string;
  name: string;
  roleLabel: string;
  badgeAccent?: 'blue' | 'red';
};

export type TrackingDestinationMarker = {
  title: string;
  subtitle: string;
  etaLabel: string;
  accent: 'blue' | 'red';
  person?: {
    imageUrl: string | null;
    initials: string;
    name: string;
    label: string;
    badgeAccent: 'blue' | 'red';
  } | null;
};

type DestinationMarkerSize = {
  bodyGap: number;
  cardMinHeight: number;
  cardWidth: number;
  destinationAvatar: number;
  destinationBadgeFont: number;
  etaBox: number;
  etaRadius: number;
  etaUnitFont: number;
  etaUnitMargin: number;
  etaValueFont: number;
  gap: number;
  paddingLeft: number;
  paddingRight: number;
  paddingY: number;
  pointer: number;
  radius: number;
  shadowBlur: number;
  shadowY: number;
  scale: number;
  subtitleFont: number;
  titleFont: number;
};

export type TrackingMapRenderState = {
  provider: GoogleMapsPoint | null;
  positionTimestampMs?: number | null;
  accuracyMeters?: number | null;
  speedKmh?: number | null;
  destination: GoogleMapsPoint | null;
  routes: TrackingMapRoute[];
  showManeuverMarkers?: boolean;
  destinationMarker: TrackingDestinationMarker;
  remainingLabel: string;
  statusLabel: string;
  headingDegrees: number | null;
  arrived: boolean;
  travelerMarker: TrackingTravelerMarker;
};

const DAKAR_CENTER: GoogleMapsPoint = { lat: 14.7167, lng: -17.4677 };
const NAVIGATION_CAMERA_TILT = NAVIGATION_CAMERA_CONFIG.tilt.low;
const NAVIGATION_CAMERA_ZOOM = NAVIGATION_CAMERA_CONFIG.zoom.near;
const TOP_VIEW_CAMERA_TILT = 0;
const TOP_VIEW_CAMERA_ZOOM = 17.4;
const TOP_VIEW_ROUTE_PADDING = { top: 92, right: 56, bottom: 128, left: 56 };
const TOP_VIEW_MIN_ZOOM = 3;
const NAVIGATION_MIN_ZOOM = 18;
const MAP_MAX_ZOOM = 21;
const ROUTE_SNAP_MAX_DISTANCE_METERS = 80;
const MARKER_STATIONARY_RADIUS_METERS = 4;
const MARKER_DEFAULT_UPDATE_INTERVAL_MS = 1000;
const MARKER_MIN_ANIMATION_DURATION_MS = 120;
const MARKER_MAX_ANIMATION_DURATION_MS = 2500;
const MANEUVER_MARKER_MIN_SPACING_METERS = 24;
const MANEUVER_MARKER_LIMIT = 48;
const ROUTE_TURN_DOT_MIN_ANGLE_DEGREES = 14;
const ROUTE_TURN_DOT_MIN_SEGMENT_METERS = 7;
const ROUTE_STROKE_MIN_WEIGHT = 8.5;
const ROUTE_STROKE_MAX_WEIGHT = 14;
const CAMERA_MIN_ANIMATION_DURATION_MS = 220;
const CAMERA_MAX_ANIMATION_DURATION_MS = 1_600;
const CAMERA_DEFAULT_UPDATE_INTERVAL_MS = 1_000;
const ROUTE_TURN_DOT_SYMBOL_PATH = 'M 0,-6 A 6,6 0 1,1 0,6 A 6,6 0 1,1 0,-6';

const DRIVER_ACTION_MANEUVERS = new Set([
  'TURN_LEFT',
  'TURN_RIGHT',
  'TURN_SLIGHT_LEFT',
  'TURN_SLIGHT_RIGHT',
  'TURN_SHARP_LEFT',
  'TURN_SHARP_RIGHT',
  'UTURN_LEFT',
  'UTURN_RIGHT',
  'ROUNDABOUT_LEFT',
  'ROUNDABOUT_RIGHT',
  'FORK_LEFT',
  'FORK_RIGHT',
  'MERGE',
  'RAMP_LEFT',
  'RAMP_RIGHT',
]);

type RouteManeuverMarkerView = {
  offsetPercent: number;
  distanceMeters: number;
};

type RouteProjection = {
  point: GoogleMapsPoint;
  segmentIndex: number;
  ratio: number;
  distanceAlongRouteMeters: number;
  distanceFromRouteMeters: number;
};

@Injectable()
export class TrackingGoogleMapRendererService {
  private readonly loader = inject(GoogleMapsLoaderService);
  private google?: GoogleMapsRuntime;
  private routeMap?: GoogleMapsMapInstance;
  private routeMapElement?: HTMLElement;
  private projectionOverlay?: GoogleMapsOverlayViewInstance;
  private providerMarker?: GoogleMapsAdvancedMarkerInstance;
  private destinationMarker?: GoogleMapsAdvancedMarkerInstance;
  private routePolylines: GoogleMapsPolylineInstance[] = [];
  private lastBoundsKey = '';
  private animationFrameId: number | null = null;
  private lastMarkerUpdateAt: number | null = null;
  private lastMarkerSourceAt: number | null = null;
  private renderedMarkerHeading = 0;
  private cameraAnimationFrameId: number | null = null;
  private lastCameraUpdateAt: number | null = null;
  private lastCameraSourceAt: number | null = null;
  private renderedCameraCenter: GoogleMapsPoint | null = null;
  private renderedCameraHeading = 0;
  private renderedCameraZoom: number = NAVIGATION_CAMERA_ZOOM;
  private renderedCameraTilt: number = NAVIGATION_CAMERA_TILT;
  private routeSelected?: (routeId: string) => void;
  private lastProviderPosition: GoogleMapsPoint | null = null;
  private applyingCameraUpdate = false;
  private controlsStyleElement?: HTMLStyleElement;
  private currentCameraHeading = 0;
  private currentTravelerHeading = 0;
  private pendingStationaryHeading: number | null = null;
  private pendingStationaryHeadingConfirmations = 0;
  private topViewEnabled = false;
  private showManeuverMarkers = false;
  private renderedRouteForIcons: TrackingMapRoute | null = null;
  private lastRenderedState: TrackingMapRenderState | null = null;
  private lastRenderedProviderPosition: GoogleMapsPoint | null = null;
  private readonly navigationCamera = new NavigationCameraEngine();
  private navigationCameraDecision: NavigationCameraDecision | null = null;

  async initializeRouteMap(
    element: HTMLElement,
    satellite: boolean,
    onRouteSelected: (routeId: string) => void,
  ): Promise<void> {
    this.google = await this.loader.load();
    if (this.routeMap && this.routeMapElement === element) return;

    this.destroyRouteMap();
    this.routeMapElement = element;
    this.routeSelected = onRouteSelected;
    this.routeMap = new this.google.maps.Map(element, {
      center: DAKAR_CENTER,
      zoom: this.cameraZoom(),
      minZoom: this.minimumZoom(),
      maxZoom: MAP_MAX_ZOOM,
      heading: 0,
      tilt: this.cameraTilt(),
      renderingType: 'VECTOR',
      mapTypeId: satellite ? 'hybrid' : 'roadmap',
      disableDefaultUI: true,
      zoomControl: false,
      fullscreenControl: false,
      mapTypeControl: false,
      rotateControl: false,
      streetViewControl: false,
      scaleControl: false,
      keyboardShortcuts: false,
      cameraControl: false,
      clickableIcons: true,
      gestureHandling: 'greedy',
      headingInteractionEnabled: false,
      tiltInteractionEnabled: false,
      mapId: this.google.mapId,
    });
    this.routeMap.addListener('heading_changed', () => {
      this.refreshRenderedTravelerRotation();
    });
    this.routeMap.addListener('idle', () => {
      this.refreshRenderedRouteStyle();
      this.refreshRenderedTravelerMarker();
      this.refreshRenderedDestinationMarker();
    });
    const OverlayView = this.google.maps.OverlayView;
    if (OverlayView) {
      this.projectionOverlay = new OverlayView();
      this.projectionOverlay.onAdd = () => undefined;
      this.projectionOverlay.draw = () => undefined;
      this.projectionOverlay.onRemove = () => undefined;
      this.projectionOverlay.setMap(this.routeMap);
    }
    this.hideNativeGoogleMapControls(element);
  }

  render(state: TrackingMapRenderState): void {
    if (!this.google || !state.provider) return;

    if (this.routeMap) {
      this.showManeuverMarkers = state.showManeuverMarkers === true;
      // Le marqueur affiche toujours le GPS filtre. La route peut aider le
      // heading, la camera et la navigation, mais ne modifie jamais la position.
      const displayedProvider = state.provider;
      this.currentTravelerHeading = this.resolveHeading(displayedProvider, state);
      if (!this.topViewEnabled) {
        this.currentCameraHeading = this.currentTravelerHeading;
      }
      this.lastRenderedState = state;
      this.lastRenderedProviderPosition = displayedProvider;
      if (state.arrived) {
        this.clearRoutePolylines();
      }
      this.providerMarker = this.upsertProviderMarker(
        this.providerMarker,
        this.routeMap,
        displayedProvider,
        state,
        this.currentTravelerHeading,
      );
      if (state.destination) {
        this.destinationMarker = this.upsertDestinationMarker(
          this.destinationMarker,
          this.routeMap,
          state.destination,
          state.destinationMarker,
        );
      }
      const visibleRoutes = state.arrived
        ? []
        : this.routesStartingAtProvider(displayedProvider, state.routes);
      this.renderRoutes(visibleRoutes);
      this.fitRoute(
        displayedProvider,
        state.destination,
        visibleRoutes,
        state.speedKmh,
        state.accuracyMeters,
        state.positionTimestampMs,
      );
      this.refreshRenderedTravelerMarker();
    }
  }

  setSatellite(enabled: boolean): void {
    this.routeMap?.setMapTypeId(enabled ? 'hybrid' : 'roadmap');
    this.applyImmersiveCamera();
  }

  setTopView(enabled: boolean): void {
    if (this.topViewEnabled === enabled) return;

    this.cancelCameraAnimation();
    this.topViewEnabled = enabled;
    this.lastBoundsKey = '';
    this.applyImmersiveCamera();
    this.refreshRenderedTravelerMarker();
    // Le changement de perspective doit recadrer le tracé courant, même si
    // Google Maps conserve encore le centre de l'itinéraire précédent.
    if (this.lastRenderedState) {
      this.render(this.lastRenderedState);
    }
  }

  setHeading(headingDegrees: number): void {
    this.cancelCameraAnimation();
    const requestedHeading = this.normalizeHeading(headingDegrees);
    this.currentCameraHeading = requestedHeading;
    const heading = this.topViewEnabled ? 0 : requestedHeading;
    this.routeMap?.setOptions?.({
      headingInteractionEnabled: false,
      tiltInteractionEnabled: false,
      rotateControl: false,
      scaleControl: false,
      zoomControl: false,
      fullscreenControl: false,
      mapTypeControl: false,
      streetViewControl: false,
      cameraControl: false,
      keyboardShortcuts: false,
    });
    this.routeMap?.moveCamera?.({
      heading,
      tilt: this.cameraTilt(),
      zoom: this.cameraZoom(),
    });
    this.routeMap?.setHeading?.(heading);
    this.routeMap?.setTilt?.(this.cameraTilt());
    this.renderedCameraHeading = heading;
    this.renderedCameraZoom = this.cameraZoom();
    this.renderedCameraTilt = this.cameraTilt();
    this.applyCssRotationFallback(0);
    this.refreshRenderedTravelerMarker();
  }

  private applyImmersiveCamera(): void {
    const heading = this.topViewEnabled ? 0 : this.currentCameraHeading;
    this.routeMap?.setOptions?.({
      minZoom: this.minimumZoom(),
      maxZoom: MAP_MAX_ZOOM,
      headingInteractionEnabled: false,
      tiltInteractionEnabled: false,
      rotateControl: false,
      scaleControl: false,
      zoomControl: false,
      fullscreenControl: false,
      mapTypeControl: false,
      streetViewControl: false,
      cameraControl: false,
      keyboardShortcuts: false,
      gestureHandling: 'greedy',
      clickableIcons: true,
    });
    this.routeMap?.setHeading?.(heading);
    this.routeMap?.setTilt?.(this.cameraTilt());
    this.routeMap?.moveCamera?.({
      heading,
      tilt: this.cameraTilt(),
      zoom: this.cameraZoom(),
    });
    this.renderedCameraHeading = heading;
    this.renderedCameraZoom = this.cameraZoom();
    this.renderedCameraTilt = this.cameraTilt();
  }

  private cameraTilt(): number {
    return this.topViewEnabled ? TOP_VIEW_CAMERA_TILT : NAVIGATION_CAMERA_TILT;
  }

  private cameraZoom(): number {
    return this.topViewEnabled ? TOP_VIEW_CAMERA_ZOOM : NAVIGATION_CAMERA_ZOOM;
  }

  private minimumZoom(): number {
    return this.topViewEnabled ? TOP_VIEW_MIN_ZOOM : NAVIGATION_MIN_ZOOM;
  }

  private withCameraUpdate(update: () => void): void {
    this.applyingCameraUpdate = true;
    update();
    window.setTimeout(() => {
      this.applyingCameraUpdate = false;
    }, 0);
  }

  private applyCssRotationFallback(headingDegrees: number): void {
    if (!this.routeMapElement) return;

    const normalizedHeading = this.normalizeHeading(headingDegrees);
    this.routeMapElement.style.transform = normalizedHeading
      ? `rotate(${normalizedHeading}deg) scale(1.22)`
      : '';
    this.routeMapElement.style.transformOrigin = '50% 50%';
    this.routeMapElement.style.transition = 'transform 260ms ease';
  }

  resetRoute(): void {
    this.clearDestinationMarker();
    this.clearRoutePolylines();
    this.lastBoundsKey = '';
    this.lastProviderPosition = null;
    this.lastMarkerUpdateAt = null;
    this.lastMarkerSourceAt = null;
    this.renderedMarkerHeading = 0;
    this.currentTravelerHeading = 0;
    this.pendingStationaryHeading = null;
    this.pendingStationaryHeadingConfirmations = 0;
    this.renderedCameraCenter = null;
    this.renderedCameraHeading = 0;
    this.renderedCameraZoom = NAVIGATION_CAMERA_ZOOM;
    this.renderedCameraTilt = NAVIGATION_CAMERA_TILT;
    this.lastCameraUpdateAt = null;
    this.lastCameraSourceAt = null;
    this.navigationCamera.reset();
    this.navigationCameraDecision = null;
  }

  destroyRouteMap(): void {
    this.cancelAnimation();
    this.cancelCameraAnimation();
    this.projectionOverlay?.setMap(null);
    this.projectionOverlay = undefined;
    this.applyCssRotationFallback(0);
    if (this.providerMarker) {
      this.providerMarker.map = null;
    }
    this.clearDestinationMarker();
    this.clearRoutePolylines();
    this.controlsStyleElement?.remove();
    this.controlsStyleElement = undefined;
    this.clearListeners(this.routeMap);
    this.providerMarker = undefined;
    this.destinationMarker = undefined;
    this.routePolylines = [];
    this.renderedRouteForIcons = null;
    this.lastRenderedState = null;
    this.navigationCamera.reset();
    this.navigationCameraDecision = null;
    this.lastRenderedProviderPosition = null;
    this.lastProviderPosition = null;
    this.lastMarkerUpdateAt = null;
    this.lastMarkerSourceAt = null;
    this.renderedMarkerHeading = 0;
    this.routeMap = undefined;
    this.routeMapElement = undefined;
    this.lastBoundsKey = '';
  }

  destroy(): void {
    this.destroyRouteMap();
  }

  private renderRoutes(routes: TrackingMapRoute[]): void {
    if (!this.google || !this.routeMap) return;
    const visibleRoutes = routes.filter((route) => route.coordinates.length >= 2);

    while (this.routePolylines.length > visibleRoutes.length) {
      this.routePolylines.pop()?.setMap(null);
    }

    if (visibleRoutes.length === 0) {
      this.renderedRouteForIcons = null;
      return;
    }

    this.renderedRouteForIcons = visibleRoutes.find((route) => route.selected) ?? null;
    visibleRoutes.forEach((route, index) => {
      const selected = route.selected;
      const options = {
        map: this.routeMap,
        path: route.coordinates,
        icons: selected ? this.routeManeuverIconSequences(route) : [],
        strokeColor: selected ? '#1eb980' : '#64748b',
        strokeOpacity: selected ? 0.96 : 0.68,
        strokeWeight: selected ? this.routeStrokeWeight() : Math.max(3, this.routeStrokeWeight() - 2),
        zIndex: selected ? 20 : 10,
        clickable: true,
      };
      let polyline = this.routePolylines[index];
      if (!polyline) {
        polyline = new this.google!.maps.Polyline(options);
        this.routePolylines[index] = polyline;
      } else {
        polyline.setOptions(options);
        polyline.setPath(route.coordinates);
        polyline.setMap(this.routeMap as GoogleMapsMapInstance);
      }
      this.google!.maps.event?.clearInstanceListeners(polyline);
      polyline.addListener('click', () => this.routeSelected?.(route.id));
    });
  }

  private routesStartingAtProvider(
    provider: GoogleMapsPoint,
    routes: TrackingMapRoute[],
  ): TrackingMapRoute[] {
    return routes.map((route) =>
      route.selected
        ? {
            ...route,
            coordinates: this.routeCoordinatesStartingAt(provider, route.coordinates),
          }
        : route,
    );
  }

  private routeCoordinatesStartingAt(
    provider: GoogleMapsPoint,
    coordinates: GoogleMapsPoint[],
  ): GoogleMapsPoint[] {
    if (coordinates.length < 2) return coordinates;

    const projection = this.projectPointToRoute(provider, coordinates);
    if (!projection || projection.distanceFromRouteMeters > ROUTE_SNAP_MAX_DISTANCE_METERS) {
      return coordinates;
    }

    const start = this.routePointAtDistance(coordinates, projection.distanceAlongRouteMeters);
    if (!start) return coordinates;

    const remainingCoordinates = coordinates.slice(start.nextIndex);
    const firstRemaining = remainingCoordinates[0];
    const startsAtExistingPoint =
      firstRemaining && this.distanceMeters(start.point, firstRemaining) < 0.5;

    return startsAtExistingPoint ? remainingCoordinates : [start.point, ...remainingCoordinates];
  }

  private routePointAtDistance(
    coordinates: GoogleMapsPoint[],
    targetDistanceMeters: number,
  ): { point: GoogleMapsPoint; nextIndex: number } | null {
    if (coordinates.length < 2) return null;
    if (targetDistanceMeters <= 0) {
      return { point: coordinates[0], nextIndex: 1 };
    }

    let coveredMeters = 0;
    for (let index = 0; index < coordinates.length - 1; index += 1) {
      const start = coordinates[index];
      const end = coordinates[index + 1];
      const segmentMeters = this.distanceMeters(start, end);
      if (segmentMeters <= 0) continue;

      if (coveredMeters + segmentMeters >= targetDistanceMeters) {
        const ratio = (targetDistanceMeters - coveredMeters) / segmentMeters;
        return {
          point: {
            lat: start.lat + (end.lat - start.lat) * ratio,
            lng: start.lng + (end.lng - start.lng) * ratio,
          },
          nextIndex: index + 1,
        };
      }

      coveredMeters += segmentMeters;
    }

    return {
      point: coordinates[coordinates.length - 1],
      nextIndex: coordinates.length,
    };
  }

  private routeManeuverIconSequences(route: TrackingMapRoute): Array<Record<string, unknown>> {
    if (!this.showManeuverMarkers) return [];

    const routeWeight = this.routeStrokeWeight();
    const scale = this.routeManeuverMarkerScale(routeWeight);
    const strokeWeight = this.routeManeuverMarkerStrokeWeight(routeWeight);
    return this.routeManeuverMarkerViews(route).map((marker) => ({
      icon: {
        path: ROUTE_TURN_DOT_SYMBOL_PATH,
        scale,
        fillColor: '#ffffff',
        fillOpacity: 1,
        strokeColor: '#111111',
        strokeOpacity: 1,
        strokeWeight,
      },
      offset: `${marker.offsetPercent.toFixed(2)}%`,
    }));
  }

  private refreshRenderedRouteStyle(): void {
    if (!this.renderedRouteForIcons) return;
    this.routePolylines[0]?.setOptions({
      strokeWeight: this.routeStrokeWeight(),
      icons: this.routeManeuverIconSequences(this.renderedRouteForIcons),
    });
  }

  private refreshRenderedTravelerMarker(): void {
    if (!this.providerMarker || !this.lastRenderedState || !this.lastRenderedProviderPosition) {
      return;
    }

    this.providerMarker.content = this.providerMarkerContent(
      this.currentTravelerHeading,
      this.lastRenderedProviderPosition,
      this.lastRenderedState.travelerMarker,
    );
  }

  private refreshRenderedTravelerRotation(): void {
    if (!this.providerMarker || !this.lastRenderedProviderPosition) return;
    const content = this.providerMarker.content;
    if (!(content instanceof HTMLElement)) return;
    const traveler = content.querySelector<HTMLElement>('.jokko-tracking-marker-direction');
    if (!traveler) return;
    const heading =
      this.visibleRouteHeading(this.lastRenderedProviderPosition) ??
      this.headingRelativeToCamera(this.currentTravelerHeading);
    traveler.style.transform = `rotate(${heading}deg)`;
  }

  private refreshRenderedDestinationMarker(): void {
    if (
      !this.destinationMarker ||
      !this.lastRenderedState?.destination ||
      this.lastRenderedState.arrived
    ) {
      return;
    }

    this.destinationMarker.content = this.destinationMarkerContent(
      this.lastRenderedState.destinationMarker,
    );
  }

  private routeStrokeWeight(): number {
    const zoom = this.currentZoomLevel();
    const normalized = Math.min(1, Math.max(0, (zoom - 15) / 6));
    const eased = 1 - Math.pow(1 - normalized, 1.65);
    return Number(
      (
        ROUTE_STROKE_MIN_WEIGHT +
        (ROUTE_STROKE_MAX_WEIGHT - ROUTE_STROKE_MIN_WEIGHT) * eased
      ).toFixed(2),
    );
  }

  private routeManeuverMarkerScale(routeWeight: number): number {
    return Number(Math.max(0.32, Math.min(0.58, routeWeight / 24)).toFixed(3));
  }

  private routeManeuverMarkerStrokeWeight(routeWeight: number): number {
    return Number(Math.max(1, Math.min(1.8, routeWeight * 0.12)).toFixed(2));
  }

  private currentZoomLevel(): number {
    const zoom = (this.routeMap as { getZoom?: () => number } | undefined)?.getZoom?.();
    return typeof zoom === 'number' && Number.isFinite(zoom) ? zoom : this.cameraZoom();
  }

  private routeManeuverMarkerViews(route: TrackingMapRoute): RouteManeuverMarkerView[] {
    const candidates: RouteManeuverMarkerView[] = [
      ...this.routeStepMarkerViews(route),
      ...this.routeGeometryTurnMarkerViews(route.coordinates),
    ].sort((left, right) => left.distanceMeters - right.distanceMeters);

    const markers: RouteManeuverMarkerView[] = [];
    let lastOffsetDistance = Number.NEGATIVE_INFINITY;

    for (const candidate of candidates) {
      if (candidate.distanceMeters - lastOffsetDistance < MANEUVER_MARKER_MIN_SPACING_METERS) {
        continue;
      }

      markers.push(candidate);
      lastOffsetDistance = candidate.distanceMeters;
      if (markers.length >= MANEUVER_MARKER_LIMIT) break;
    }

    return markers;
  }

  private routeStepMarkerViews(route: TrackingMapRoute): RouteManeuverMarkerView[] {
    const markers: RouteManeuverMarkerView[] = [];

    for (const step of route.navigationSteps ?? []) {
      if (!this.isImportantNavigationStep(step) || !step.start) continue;

      const offset = this.routeOffsetAt(step.start, route.coordinates);
      if (!offset) continue;

      markers.push({
        offsetPercent: offset.percent,
        distanceMeters: offset.distanceMeters,
      });
    }

    return markers;
  }

  private routeGeometryTurnMarkerViews(coordinates: GoogleMapsPoint[]): RouteManeuverMarkerView[] {
    if (coordinates.length < 3) return [];

    const segmentLengths = coordinates
      .slice(1)
      .map((point, index) => this.distanceMeters(coordinates[index], point));
    const totalDistanceMeters = segmentLengths.reduce((total, length) => total + length, 0);
    if (totalDistanceMeters <= 0) return [];

    const markers: RouteManeuverMarkerView[] = [];
    let distanceAlongRoute = 0;

    for (let index = 1; index < coordinates.length - 1; index += 1) {
      distanceAlongRoute += segmentLengths[index - 1] ?? 0;
      const previousLength = segmentLengths[index - 1] ?? 0;
      const nextLength = segmentLengths[index] ?? 0;
      if (
        previousLength < ROUTE_TURN_DOT_MIN_SEGMENT_METERS ||
        nextLength < ROUTE_TURN_DOT_MIN_SEGMENT_METERS
      ) {
        continue;
      }

      const previousBearing = this.bearing(coordinates[index - 1], coordinates[index]);
      const nextBearing = this.bearing(coordinates[index], coordinates[index + 1]);
      if (this.headingDifference(previousBearing, nextBearing) < ROUTE_TURN_DOT_MIN_ANGLE_DEGREES) {
        continue;
      }

      markers.push({
        distanceMeters: distanceAlongRoute,
        offsetPercent: Math.min(99, Math.max(1, (distanceAlongRoute / totalDistanceMeters) * 100)),
      });
    }

    return markers;
  }

  private isImportantNavigationStep(step: TrackingMapNavigationStep): boolean {
    const maneuver = this.normalizedDriverActionManeuver(step.maneuver);
    if (maneuver) return true;

    const instruction = step.instruction
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();

    if (!instruction.trim()) return false;
    if (/\b(continuez|continuer|tout droit|continue|straight)\b/.test(instruction)) {
      return false;
    }

    return /\b(tournez|tourner|prenez|prendre|rond-point|rond point|sortie|bretelle|embranchement|bifurcation|fourche|serrez|rejoignez|fusionnez|demi-tour|croisement|intersection)\b/.test(
      instruction,
    );
  }

  private normalizedDriverActionManeuver(maneuver: string | null): string | null {
    const normalized =
      maneuver
        ?.trim()
        .toUpperCase()
        .replace(/[^A-Z0-9]+/g, '_') ?? '';
    return DRIVER_ACTION_MANEUVERS.has(normalized) ? normalized : null;
  }

  private routeOffsetAt(
    position: GoogleMapsPoint,
    coordinates: GoogleMapsPoint[],
  ): { percent: number; distanceMeters: number } | null {
    if (coordinates.length < 2) return null;

    const segmentLengths = coordinates
      .slice(1)
      .map((point, index) => this.distanceMeters(coordinates[index], point));
    const totalDistance = segmentLengths.reduce((total, length) => total + length, 0);
    if (totalDistance <= 0) return null;

    let distanceBeforeSegment = 0;
    let bestDistanceAlongRoute = 0;
    let nearestDistance = Number.POSITIVE_INFINITY;

    for (let index = 0; index < coordinates.length - 1; index += 1) {
      const start = coordinates[index];
      const end = coordinates[index + 1];
      const segmentLength = segmentLengths[index] ?? 0;
      if (segmentLength <= 0) continue;

      const projection = this.projectPointToSegment(position, start, end);
      if (projection.distanceSquared < nearestDistance) {
        nearestDistance = projection.distanceSquared;
        bestDistanceAlongRoute = distanceBeforeSegment + segmentLength * projection.ratio;
      }
      distanceBeforeSegment += segmentLength;
    }

    return {
      distanceMeters: bestDistanceAlongRoute,
      percent: Math.min(99, Math.max(1, (bestDistanceAlongRoute / totalDistance) * 100)),
    };
  }

  private projectPointToSegment(
    point: GoogleMapsPoint,
    start: GoogleMapsPoint,
    end: GoogleMapsPoint,
  ): { ratio: number; distanceSquared: number } {
    const deltaLat = end.lat - start.lat;
    const deltaLng = end.lng - start.lng;
    const lengthSquared = deltaLat * deltaLat + deltaLng * deltaLng;
    if (lengthSquared <= 0) {
      return {
        ratio: 0,
        distanceSquared: Math.pow(point.lat - start.lat, 2) + Math.pow(point.lng - start.lng, 2),
      };
    }

    const ratio = Math.min(
      1,
      Math.max(
        0,
        ((point.lat - start.lat) * deltaLat + (point.lng - start.lng) * deltaLng) / lengthSquared,
      ),
    );
    const projected = {
      lat: start.lat + deltaLat * ratio,
      lng: start.lng + deltaLng * ratio,
    };

    return {
      ratio,
      distanceSquared:
        Math.pow(point.lat - projected.lat, 2) + Math.pow(point.lng - projected.lng, 2),
    };
  }

  private upsertProviderMarker(
    marker: GoogleMapsAdvancedMarkerInstance | undefined,
    map: GoogleMapsMapInstance,
    position: GoogleMapsPoint,
    state: TrackingMapRenderState,
    heading: number,
  ): GoogleMapsAdvancedMarkerInstance {
    const AdvancedMarkerElement = this.google?.maps.marker?.AdvancedMarkerElement;
    if (!AdvancedMarkerElement) {
      throw new Error('GOOGLE_MAPS_NOT_INITIALIZED');
    }
    if (!marker) {
      this.lastProviderPosition = position;
      this.lastMarkerUpdateAt = this.animationClock();
      this.lastMarkerSourceAt = this.validTimestamp(state.positionTimestampMs);
      this.renderedMarkerHeading = heading;
      return new AdvancedMarkerElement({
        map,
        position,
        title: 'Prestataire en route',
        content: this.providerMarkerContent(heading, position, state.travelerMarker),
        anchorLeft: '-50%',
        anchorTop: this.providerMarkerAnchorTop(state.travelerMarker),
        zIndex: 30,
      });
    }

    this.applyProviderMarkerAnchor(marker, state.travelerMarker);
    marker.content = this.providerMarkerContent(
      this.renderedMarkerHeading,
      position,
      state.travelerMarker,
    );
    if (state.arrived) {
      this.cancelAnimation();
      marker.position = position;
      this.setMarkerHeading(marker, heading);
      this.renderedMarkerHeading = heading;
      this.lastMarkerUpdateAt = this.animationClock();
      this.lastMarkerSourceAt = this.validTimestamp(state.positionTimestampMs);
    } else {
      this.animateMarker(marker, position, heading, state.speedKmh, state.positionTimestampMs);
    }
    this.lastProviderPosition = position;
    return marker;
  }

  private applyProviderMarkerAnchor(
    marker: GoogleMapsAdvancedMarkerInstance,
    travelerMarker: TrackingTravelerMarker,
  ): void {
    const anchoredMarker = marker as GoogleMapsAdvancedMarkerInstance & {
      anchorLeft?: string;
      anchorTop?: string;
    };
    anchoredMarker.anchorLeft = '-50%';
    anchoredMarker.anchorTop = this.providerMarkerAnchorTop(travelerMarker);
  }

  private providerMarkerAnchorTop(travelerMarker: TrackingTravelerMarker): string {
    if (travelerMarker.kind === 'navigation') {
      return `-${Math.round(this.navigationMarkerSize().shell / 2)}px`;
    }

    if (travelerMarker.kind === 'vehicle') {
      return '-52px';
    }

    return '-26px';
  }

  private upsertDestinationMarker(
    marker: GoogleMapsAdvancedMarkerInstance | undefined,
    map: GoogleMapsMapInstance,
    position: GoogleMapsPoint,
    destinationMarker: TrackingDestinationMarker,
  ): GoogleMapsAdvancedMarkerInstance {
    const AdvancedMarkerElement = this.google?.maps.marker?.AdvancedMarkerElement;
    if (!AdvancedMarkerElement) {
      throw new Error('GOOGLE_MAPS_NOT_INITIALIZED');
    }
    if (!marker) {
      return new AdvancedMarkerElement({
        map,
        position,
        title: 'Destination',
        content: this.destinationMarkerContent(destinationMarker),
        zIndex: 25,
      });
    }

    marker.position = position;
    marker.content = this.destinationMarkerContent(destinationMarker);
    return marker;
  }

  private animateMarker(
    marker: GoogleMapsAdvancedMarkerInstance,
    destination: GoogleMapsPoint,
    destinationHeading: number,
    speedKmh: number | null | undefined,
    sourceTimestampMs: number | null | undefined,
  ): void {
    const current = this.markerPosition(marker);
    if (!current || typeof requestAnimationFrame === 'undefined') {
      marker.position = destination;
      this.setMarkerHeading(marker, destinationHeading);
      this.renderedMarkerHeading = destinationHeading;
      return;
    }

    const receivedAt = this.animationClock();
    const sourceAt = this.validTimestamp(sourceTimestampMs);
    const sourceInterval =
      sourceAt !== null && this.lastMarkerSourceAt !== null
        ? sourceAt - this.lastMarkerSourceAt
        : null;
    const updateInterval =
      sourceInterval !== null && sourceInterval > 0
        ? sourceInterval
        : this.lastMarkerUpdateAt === null
          ? MARKER_DEFAULT_UPDATE_INTERVAL_MS
          : receivedAt - this.lastMarkerUpdateAt;
    this.lastMarkerUpdateAt = receivedAt;
    if (sourceAt !== null) this.lastMarkerSourceAt = sourceAt;
    const distance = this.distanceMeters(current, destination);
    const movementThreshold = (speedKmh ?? 0) >= 3 ? 0.5 : MARKER_STATIONARY_RADIUS_METERS;
    if (distance < movementThreshold) {
      this.setMarkerHeading(marker, destinationHeading);
      this.renderedMarkerHeading = destinationHeading;
      return;
    }

    this.cancelAnimation();
    const origin = current;
    const originHeading = this.renderedMarkerHeading;
    const headingDelta = ((destinationHeading - originHeading + 540) % 360) - 180;
    const duration = Math.min(
      MARKER_MAX_ANIMATION_DURATION_MS,
      Math.max(MARKER_MIN_ANIMATION_DURATION_MS, updateInterval * 1.08),
    );
    const startedAt = receivedAt;
    const animate = (timestamp: number): void => {
      const elapsed = timestamp - startedAt;
      const progress = Math.min(1, elapsed / duration);
      // Smoothstep conserve une vitesse fluide, sans depassement du point GPS.
      const eased = progress * progress * (3 - 2 * progress);
      marker.position = {
        lat: origin.lat + (destination.lat - origin.lat) * eased,
        lng: origin.lng + (destination.lng - origin.lng) * eased,
      };
      this.renderedMarkerHeading = this.normalizeHeading(originHeading + headingDelta * eased);
      this.setMarkerHeading(marker, this.renderedMarkerHeading);
      if (elapsed < duration) {
        this.animationFrameId = requestAnimationFrame(animate);
      } else {
        this.animationFrameId = null;
      }
    };
    this.animationFrameId = requestAnimationFrame(animate);
  }

  private setMarkerHeading(marker: GoogleMapsAdvancedMarkerInstance, headingDegrees: number): void {
    const content = marker.content;
    if (!(content instanceof HTMLElement)) return;
    const direction = content.querySelector<HTMLElement>('.jokko-tracking-marker-direction');
    if (!direction) return;
    direction.style.transition = 'none';
    direction.style.transform = `rotate(${this.headingRelativeToCamera(headingDegrees)}deg)`;
  }

  private animationClock(): number {
    return typeof performance !== 'undefined' ? performance.now() : Date.now();
  }

  private validTimestamp(value: number | null | undefined): number | null {
    return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : null;
  }

  private fitRoute(
    provider: GoogleMapsPoint,
    destination: GoogleMapsPoint | null,
    routes: TrackingMapRoute[],
    speedKmh: number | null | undefined,
    accuracyMeters: number | null | undefined,
    sourceTimestampMs: number | null | undefined,
  ): void {
    if (!this.google || !this.routeMap) return;
    if (!destination) {
      const heading = this.topViewEnabled ? 0 : this.currentCameraHeading;
      const focus = this.navigationCameraCenter(
        provider,
        [],
        heading,
        speedKmh,
        accuracyMeters,
        null,
      );
      const targetZoom = this.topViewEnabled
        ? TOP_VIEW_CAMERA_ZOOM
        : this.navigationCameraZoom(speedKmh);
      const targetTilt = this.topViewEnabled
        ? TOP_VIEW_CAMERA_TILT
        : this.navigationCameraTilt(speedKmh);
      const key = [
        'provider-only',
        provider.lat.toFixed(6),
        provider.lng.toFixed(6),
        this.currentCameraHeading.toFixed(1),
        targetZoom.toFixed(2),
        targetTilt.toFixed(1),
        this.topViewEnabled ? 'top' : 'nav',
      ].join('|');
      if (key === this.lastBoundsKey) return;
      this.lastBoundsKey = key;
      this.animateFollowCamera(focus, heading, speedKmh, sourceTimestampMs);
      return;
    }

    const selectedRouteCoordinates =
      routes.find((route) => route.selected)?.coordinates ?? routes[0]?.coordinates ?? [];
    const routeCameraKey = this.routeCameraKey(selectedRouteCoordinates);
    if (this.topViewEnabled) {
      const selectedRouteId =
        routes.find((route) => route.selected)?.id ?? routes[0]?.id ?? 'route';
      const routeReady = selectedRouteCoordinates.length >= 2;
      const key = [
        'top-route',
        selectedRouteId,
        destination.lat.toFixed(6),
        destination.lng.toFixed(6),
        routeCameraKey,
        routeReady ? 'ready' : 'pending',
      ].join('|');
      if (key === this.lastBoundsKey) return;
      this.cancelCameraAnimation();
      this.withCameraUpdate(() => {
        const bounds = new this.google!.maps.LatLngBounds();
        bounds.extend(provider);
        bounds.extend(destination);
        selectedRouteCoordinates.forEach((coordinate) => bounds.extend(coordinate));
        this.routeMap?.fitBounds(bounds, TOP_VIEW_ROUTE_PADDING);
        this.routeMap?.setHeading?.(0);
        this.routeMap?.setTilt?.(TOP_VIEW_CAMERA_TILT);
      });
      if (routeReady) {
        this.lastBoundsKey = key;
      }
      return;
    }

    const focus = this.navigationCameraCenter(
      provider,
      selectedRouteCoordinates,
      this.currentCameraHeading,
      speedKmh,
      accuracyMeters,
      this.nextManeuverDistanceMeters(provider, routes.find((route) => route.selected) ?? routes[0]),
    );
    const targetZoom = this.navigationCameraZoom(speedKmh);
    const targetTilt = this.navigationCameraTilt(speedKmh);
    const key = [
      focus.lat.toFixed(6),
      focus.lng.toFixed(6),
      this.currentCameraHeading.toFixed(1),
      targetZoom.toFixed(2),
      targetTilt.toFixed(1),
      routeCameraKey,
      destination.lat.toFixed(6),
      destination.lng.toFixed(6),
      this.topViewEnabled ? 'top' : 'nav',
    ].join('|');
    if (key === this.lastBoundsKey) return;
    this.lastBoundsKey = key;
    this.animateFollowCamera(
      focus,
      this.currentCameraHeading,
      speedKmh,
      sourceTimestampMs,
    );
  }

  private routeCameraKey(coordinates: GoogleMapsPoint[]): string {
    if (coordinates.length === 0) return 'empty';

    const points = [
      coordinates[0],
      coordinates[Math.floor(coordinates.length / 2)],
      coordinates[coordinates.length - 1],
    ];
    return [
      coordinates.length,
      ...points.flatMap((point) => [point.lat.toFixed(5), point.lng.toFixed(5)]),
    ].join(':');
  }

  private animateFollowCamera(
    targetCenter: GoogleMapsPoint,
    targetHeadingDegrees: number,
    speedKmh: number | null | undefined,
    sourceTimestampMs: number | null | undefined,
  ): void {
    if (!this.routeMap) return;
    const requestedHeading = this.normalizeHeading(targetHeadingDegrees);
    const requestedHeadingDelta = shortestAngleDelta(this.renderedCameraHeading, requestedHeading);
    const targetHeading =
      Math.abs(requestedHeadingDelta) < 1.5 ? this.renderedCameraHeading : requestedHeading;
    const targetZoom = this.topViewEnabled
      ? TOP_VIEW_CAMERA_ZOOM
      : this.navigationCameraZoom(speedKmh);
    const targetTilt = this.topViewEnabled
      ? TOP_VIEW_CAMERA_TILT
      : this.navigationCameraTilt(speedKmh);
    const receivedAt = this.animationClock();
    const sourceAt = this.validTimestamp(sourceTimestampMs);
    const sourceInterval =
      sourceAt !== null && this.lastCameraSourceAt !== null
        ? sourceAt - this.lastCameraSourceAt
        : null;
    const updateInterval =
      sourceInterval !== null && sourceInterval > 0
        ? sourceInterval
        : this.lastCameraUpdateAt === null
          ? CAMERA_DEFAULT_UPDATE_INTERVAL_MS
          : receivedAt - this.lastCameraUpdateAt;
    this.lastCameraUpdateAt = receivedAt;
    if (sourceAt !== null) this.lastCameraSourceAt = sourceAt;
    if (typeof requestAnimationFrame === 'undefined' || typeof performance === 'undefined') {
      this.routeMap.moveCamera?.({
        center: targetCenter,
        heading: targetHeading,
        zoom: targetZoom,
        tilt: targetTilt,
      });
      this.renderedCameraCenter = targetCenter;
      this.renderedCameraHeading = targetHeading;
      this.renderedCameraZoom = targetZoom;
      this.renderedCameraTilt = targetTilt;
      return;
    }

    this.cancelCameraAnimation();
    const originCenter = this.renderedCameraCenter ?? targetCenter;
    const originHeading = this.renderedCameraHeading;
    const originZoom = this.renderedCameraZoom;
    const originTilt = this.renderedCameraTilt;
    const headingDelta = shortestAngleDelta(originHeading, targetHeading);
    const startedAt = performance.now();
    const duration = Math.min(
      CAMERA_MAX_ANIMATION_DURATION_MS,
      Math.max(CAMERA_MIN_ANIMATION_DURATION_MS, updateInterval * 1.05),
    );

    const animate = (timestamp: number): void => {
      const progress = Math.min(1, (timestamp - startedAt) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      const center = {
        lat: originCenter.lat + (targetCenter.lat - originCenter.lat) * eased,
        lng: originCenter.lng + (targetCenter.lng - originCenter.lng) * eased,
      };
      const heading = this.normalizeHeading(originHeading + headingDelta * eased);
      const zoom = originZoom + (targetZoom - originZoom) * eased;
      const tilt = originTilt + (targetTilt - originTilt) * eased;
      this.routeMap?.moveCamera?.({
        center,
        heading,
        zoom,
        tilt,
      });
      this.renderedCameraCenter = center;
      this.renderedCameraHeading = heading;
      this.renderedCameraZoom = zoom;
      this.renderedCameraTilt = tilt;
      if (progress < 1) {
        this.cameraAnimationFrameId = requestAnimationFrame(animate);
      } else {
        this.cameraAnimationFrameId = null;
      }
    };
    this.cameraAnimationFrameId = requestAnimationFrame(animate);
  }

  private navigationCameraCenter(
    provider: GoogleMapsPoint,
    routeCoordinates: GoogleMapsPoint[],
    headingDegrees: number,
    speedKmh: number | null | undefined,
    accuracyMeters: number | null | undefined,
    nextManeuverDistanceMeters: number | null,
  ): GoogleMapsPoint {
    const input = {
      position: provider,
      headingDegrees,
      speedKmh,
      accuracyMeters,
      routeTarget: null,
      nextManeuverDistanceMeters,
    };
    const baseDecision = this.navigationCamera.decide(input);
    const routeTarget = this.routePointAhead(provider, routeCoordinates, baseDecision.lookAheadMeters);
    this.navigationCameraDecision = this.navigationCamera.applyRouteTarget(
      input,
      baseDecision,
      routeTarget,
    );
    return this.navigationCameraDecision.target;
  }

  private navigationCameraZoom(speedKmh: number | null | undefined): number {
    if (this.navigationCameraDecision) return this.navigationCameraDecision.zoom;
    const speed = speedKmh ?? 0;
    if (speed >= 90) return 18.2;
    if (speed >= 60) return 18.6;
    if (speed >= 30) return 19;
    if (speed >= 10) return 19.4;
    return 19.8;
  }

  private navigationCameraTilt(speedKmh: number | null | undefined): number {
    if (this.navigationCameraDecision) return this.navigationCameraDecision.tilt;
    const speed = speedKmh ?? 0;
    if (speed >= 70) return 60;
    if (speed >= 30) return 63;
    return 67;
  }

  private nextManeuverDistanceMeters(
    provider: GoogleMapsPoint,
    route: TrackingMapRoute | undefined,
  ): number | null {
    if (!route?.navigationSteps?.length || route.coordinates.length < 2) return null;

    const providerProjection = this.projectPointToRoute(provider, route.coordinates);
    if (
      !providerProjection ||
      providerProjection.distanceFromRouteMeters > ROUTE_SNAP_MAX_DISTANCE_METERS
    ) {
      return null;
    }

    const distances = route.navigationSteps.flatMap((step) => {
      if (!step.start || !step.maneuver || step.maneuver === 'CONTINUE') return [];
      const maneuverProjection = this.projectPointToRoute(step.start, route.coordinates);
      if (!maneuverProjection) return [];
      const distance =
        maneuverProjection.distanceAlongRouteMeters - providerProjection.distanceAlongRouteMeters;
      return distance >= 0 ? [distance] : [];
    });
    return distances.length > 0 ? Math.min(...distances) : null;
  }

  private routePointAhead(
    provider: GoogleMapsPoint,
    routeCoordinates: GoogleMapsPoint[],
    lookAheadMeters: number,
  ): GoogleMapsPoint | null {
    if (routeCoordinates.length < 2) {
      return null;
    }

    const projection = this.projectPointToRoute(provider, routeCoordinates);
    if (!projection || projection.distanceFromRouteMeters > ROUTE_SNAP_MAX_DISTANCE_METERS) {
      return null;
    }
    const startSegmentIndex = projection?.segmentIndex ?? 0;
    const startPoint = projection?.point ?? routeCoordinates[0];
    let coveredMeters = 0;

    for (let index = startSegmentIndex; index < routeCoordinates.length - 1; index += 1) {
      const start = index === startSegmentIndex ? startPoint : routeCoordinates[index];
      const end = routeCoordinates[index + 1];
      const segmentMeters = this.distanceMeters(start, end);
      if (segmentMeters <= 0) continue;

      if (coveredMeters + segmentMeters >= lookAheadMeters) {
        const ratio = (lookAheadMeters - coveredMeters) / segmentMeters;
        return {
          lat: start.lat + (end.lat - start.lat) * ratio,
          lng: start.lng + (end.lng - start.lng) * ratio,
        };
      }

      coveredMeters += segmentMeters;
    }

    return routeCoordinates[routeCoordinates.length - 1];
  }

  private projectPointToRoute(
    point: GoogleMapsPoint,
    routeCoordinates: GoogleMapsPoint[],
  ): RouteProjection | null {
    if (routeCoordinates.length < 2) return null;

    let nearestProjection: RouteProjection | null = null;
    let distanceBeforeSegment = 0;

    for (let index = 0; index < routeCoordinates.length - 1; index += 1) {
      const actualStart = routeCoordinates[index];
      const actualEnd = routeCoordinates[index + 1];
      const segmentMeters = this.distanceMeters(actualStart, actualEnd);
      if (segmentMeters <= 0) continue;

      const segmentProjection = this.projectPointToSegment(point, actualStart, actualEnd);
      const projectedPoint = {
        lat: actualStart.lat + (actualEnd.lat - actualStart.lat) * segmentProjection.ratio,
        lng: actualStart.lng + (actualEnd.lng - actualStart.lng) * segmentProjection.ratio,
      };
      const distanceFromRouteMeters = this.distanceMeters(point, projectedPoint);

      if (
        !nearestProjection ||
        distanceFromRouteMeters < nearestProjection.distanceFromRouteMeters
      ) {
        nearestProjection = {
          point: projectedPoint,
          segmentIndex: index,
          ratio: segmentProjection.ratio,
          distanceAlongRouteMeters: distanceBeforeSegment + segmentMeters * segmentProjection.ratio,
          distanceFromRouteMeters,
        };
      }

      distanceBeforeSegment += segmentMeters;
    }

    return nearestProjection;
  }

  private clearDestinationMarker(): void {
    if (this.destinationMarker) {
      this.destinationMarker.map = null;
    }
    this.destinationMarker = undefined;
  }

  private clearRoutePolylines(): void {
    this.routePolylines.forEach((polyline) => polyline.setMap(null));
    this.routePolylines = [];
  }

  private hideNativeGoogleMapControls(element: HTMLElement): void {
    this.controlsStyleElement?.remove();
    const style = document.createElement('style');
    style.textContent = `
      .jokko-tracking-google-map .gm-control-active,
      .jokko-tracking-google-map .gmnoprint,
      .jokko-tracking-google-map .gm-fullscreen-control,
      .jokko-tracking-google-map .gm-bundled-control,
      .jokko-tracking-google-map .gm-bundled-control-on-bottom,
      .jokko-tracking-google-map [aria-label*="Rotate"],
      .jokko-tracking-google-map [aria-label*="Incliner"],
      .jokko-tracking-google-map [aria-label*="Faire pivoter"],
      .jokko-tracking-google-map [aria-label*="Tilt"],
      .jokko-tracking-google-map [aria-label*="Camera"],
      .jokko-tracking-google-map [aria-label*="Caméra"],
      .jokko-tracking-google-map [aria-label*="Keyboard shortcuts"],
      .jokko-tracking-google-map [aria-label*="Raccourcis clavier"] {
        display: none !important;
        opacity: 0 !important;
        pointer-events: none !important;
      }
    `;
    element.classList.add('jokko-tracking-google-map');
    element.appendChild(style);
    this.controlsStyleElement = style;
  }

  private providerMarkerContent(
    headingDegrees: number,
    position: GoogleMapsPoint,
    travelerMarker: TrackingTravelerMarker,
  ): HTMLElement {
    const content = document.createElement('div');
    content.className = 'jokko-tracking-taxi-marker';
    content.dataset['latitude'] = String(position.lat);
    content.dataset['longitude'] = String(position.lng);
    content.style.cssText = 'display:grid;justify-items:center;pointer-events:none;';

    const traveler = document.createElement('div');
    traveler.className = 'jokko-tracking-marker-direction';
    const markerHeading =
      this.visibleRouteHeading(position) ?? this.headingRelativeToCamera(headingDegrees);
    const navigationSize = this.navigationMarkerSize();
    traveler.style.cssText =
      travelerMarker.kind === 'navigation'
        ? `align-items:center;background:transparent;border:0;display:flex;height:${navigationSize.container}px;justify-content:center;overflow:visible;transform:rotate(${markerHeading}deg);transform-origin:50% 55%;transition:transform 500ms ease;width:${navigationSize.container}px;`
        : travelerMarker.kind === 'vehicle'
          ? `align-items:center;background:transparent;border:0;display:flex;height:104px;justify-content:center;overflow:visible;transform:rotate(${markerHeading}deg);transform-origin:50% 55%;transition:transform 500ms ease;width:124px;`
          : 'align-items:center;background:#eff6ff;border:3px solid #2f80ff;border-radius:999px;box-shadow:0 10px 20px rgba(15,23,42,.28);display:flex;height:52px;justify-content:center;overflow:hidden;transform-origin:50% 50%;transition:transform 500ms ease;width:52px;';
    traveler.appendChild(this.travelerMarkerVisual(travelerMarker));

    const badge = this.travelerMarkerBadge(travelerMarker);
    if (badge) {
      content.append(traveler, badge);
    } else {
      content.append(traveler);
    }
    return content;
  }

  private travelerMarkerBadge(marker: TrackingTravelerMarker): HTMLElement | null {
    const label = marker.roleLabel.trim();
    if (marker.kind !== 'avatar' || !label) return null;

    const accentColor = marker.badgeAccent === 'red' ? '#ff3b30' : '#2f80ff';
    const badge = document.createElement('span');
    badge.textContent = label;
    badge.style.cssText = `background:${accentColor};border:2px solid rgba(255,255,255,.92);border-radius:10px;color:#fff;font:900 13px/1 "DM Sans",sans-serif;letter-spacing:0;margin-top:-4px;max-width:116px;overflow:hidden;padding:6px 9px;text-overflow:ellipsis;white-space:nowrap;`;
    return badge;
  }

  private travelerMarkerVisual(marker: TrackingTravelerMarker): HTMLElement {
    if (marker.kind === 'navigation') {
      const size = this.navigationMarkerSize();
      const shell = document.createElement('span');
      shell.setAttribute('aria-label', marker.name || 'Navigation');
      shell.style.cssText = `align-items:center;background:rgba(255,255,255,.92);border-radius:999px;box-shadow:0 9px 18px rgba(15,23,42,.22);display:flex;height:${size.shell}px;justify-content:center;width:${size.shell}px;`;

      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('viewBox', '0 0 64 64');
      svg.setAttribute('width', String(size.icon));
      svg.setAttribute('height', String(size.icon));
      svg.setAttribute('aria-hidden', 'true');
      svg.style.cssText =
        'display:block;filter:drop-shadow(0 2px 2px rgba(15,23,42,.24));transform:translateY(-1px);transform-origin:50% 50%;';

      const arrow = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      arrow.setAttribute('d', 'M32 4 51 56 33.5 45.5 16 56 32 4Z');
      arrow.setAttribute('fill', '#1a73e8');
      arrow.setAttribute('stroke', '#ffffff');
      arrow.setAttribute('stroke-width', '2.2');
      arrow.setAttribute('stroke-linejoin', 'round');

      svg.appendChild(arrow);
      shell.appendChild(svg);
      return shell;
    }

    if (marker.imageUrl) {
      const image = document.createElement('img');
      image.src = marker.imageUrl;
      image.alt = marker.name;
      image.referrerPolicy = 'no-referrer';
      image.style.cssText =
        marker.kind === 'vehicle'
          ? 'display:block;filter:drop-shadow(0 16px 14px rgba(15,23,42,.38));height:96px;object-fit:contain;width:116px;'
          : 'display:block;height:100%;object-fit:cover;width:100%;';
      image.onerror = () => {
        image.replaceWith(this.initialsMarker(marker.initials));
      };
      return image;
    }

    return this.initialsMarker(marker.initials);
  }

  private navigationMarkerSize(): {
    container: number;
    shell: number;
    icon: number;
  } {
    const zoom = this.currentZoomLevel();
    const shell =
      zoom <= 16 ? 34 : zoom <= 17 ? 38 : zoom <= 18 ? 42 : zoom <= 19 ? 46 : zoom <= 20 ? 50 : 54;

    return {
      container: shell + 10,
      shell,
      icon: Math.round(shell * 0.72),
    };
  }

  private initialsMarker(initials: string): HTMLElement {
    const fallback = document.createElement('span');
    fallback.textContent = initials || 'JK';
    fallback.style.cssText =
      'align-items:center;color:#0f172a;display:flex;font:900 14px/1 "DM Sans",sans-serif;height:100%;justify-content:center;width:100%;';
    return fallback;
  }

  private destinationMarkerContent(marker: TrackingDestinationMarker): HTMLElement {
    const content = document.createElement('div');
    const accentColor = marker.accent === 'red' ? '#ff3b30' : '#2f80ff';
    const eta = this.splitEtaLabel(marker.etaLabel);
    const size = this.destinationMarkerSize();

    content.className = 'jokko-tracking-arrival-marker';
    content.style.cssText = `align-items:center;display:flex;flex-direction:column;pointer-events:none;width:${size.cardWidth}px;`;

    const card = document.createElement('div');
    card.style.cssText = `align-items:center;background:#fff;border:1px solid rgba(15,23,42,.08);border-radius:${size.radius}px;box-shadow:0 ${size.shadowY}px ${size.shadowBlur}px rgba(15,23,42,.18);display:flex;gap:${size.gap}px;min-height:${size.cardMinHeight}px;padding:${size.paddingY}px ${size.paddingRight}px ${size.paddingY}px ${size.paddingLeft}px;width:100%;`;

    const etaBox = document.createElement('span');
    etaBox.style.cssText = `align-items:center;background:${accentColor};border-radius:${size.etaRadius}px;color:#fff;display:flex;flex-direction:column;height:${size.etaBox}px;justify-content:center;min-width:${size.etaBox}px;text-transform:uppercase;`;

    const etaValue = document.createElement('strong');
    etaValue.textContent = eta.value;
    etaValue.style.cssText = `font:900 ${size.etaValueFont}px/1 "DM Sans",sans-serif;letter-spacing:0;`;

    const etaUnit = document.createElement('small');
    etaUnit.textContent = eta.unit;
    etaUnit.style.cssText = `font:800 ${size.etaUnitFont}px/1.1 "DM Sans",sans-serif;letter-spacing:0;margin-top:${size.etaUnitMargin}px;opacity:.86;`;

    const body = document.createElement('span');
    body.style.cssText = `display:flex;flex:1;flex-direction:column;gap:${size.bodyGap}px;min-width:0;white-space:nowrap;`;

    const title = document.createElement('strong');
    title.textContent = marker.title;
    title.style.cssText = `color:#111827;font:900 ${size.titleFont}px/1.15 "DM Sans",sans-serif;letter-spacing:0;overflow:hidden;text-overflow:ellipsis;`;

    const subtitle = document.createElement('small');
    subtitle.textContent = marker.subtitle;
    subtitle.style.cssText = `color:#64748b;font:700 ${size.subtitleFont}px/1 "DM Sans",sans-serif;letter-spacing:0;text-transform:uppercase;`;

    const pointer = document.createElement('span');
    pointer.className = 'jokko-tracking-arrival-pointer';
    pointer.style.cssText = `background:#fff;border-bottom:1px solid rgba(15,23,42,.08);border-right:1px solid rgba(15,23,42,.08);box-shadow:${Math.round(size.shadowY / 2)}px ${Math.round(size.shadowY / 2)}px ${Math.round(size.shadowBlur / 2)}px rgba(15,23,42,.08);height:${size.pointer}px;margin-top:-${Math.round(size.pointer / 2)}px;transform:rotate(45deg);width:${size.pointer}px;`;

    body.append(title, subtitle);
    etaBox.append(etaValue, etaUnit);
    card.append(etaBox, body);
    const person = this.destinationPersonContent(marker, size);
    if (person) {
      // L'AdvancedMarker est ancre sur le bas de son contenu. L'avatar doit
      // donc rester au-dessus de la carte : la pointe est ainsi le seul
      // element au contact de la coordonnee de destination.
      content.append(person, card, pointer);
    } else {
      content.append(card, pointer);
    }
    return content;
  }

  private destinationPersonContent(
    marker: TrackingDestinationMarker,
    size: DestinationMarkerSize,
  ): HTMLElement | null {
    if (!marker.person) return null;

    const accentColor = marker.person.badgeAccent === 'red' ? '#ff3b30' : '#2f80ff';
    const wrapper = document.createElement('span');
    wrapper.style.cssText = `align-items:center;display:flex;flex-direction:column;margin-top:${Math.max(4, Math.round(6 * size.scale))}px;`;

    const avatar = document.createElement('span');
    avatar.style.cssText = `align-items:center;background:#eff6ff;border:${Math.max(2, Math.round(3 * size.scale))}px solid ${accentColor};border-radius:999px;box-shadow:0 ${Math.round(8 * size.scale)}px ${Math.round(16 * size.scale)}px rgba(15,23,42,.24);display:flex;height:${size.destinationAvatar}px;justify-content:center;overflow:hidden;width:${size.destinationAvatar}px;`;

    if (marker.person.imageUrl) {
      const image = document.createElement('img');
      image.src = marker.person.imageUrl;
      image.alt = marker.person.name;
      image.referrerPolicy = 'no-referrer';
      image.style.cssText = 'display:block;height:100%;object-fit:cover;width:100%;';
      image.onerror = () => {
        image.replaceWith(this.initialsMarker(marker.person?.initials ?? 'JK'));
      };
      avatar.appendChild(image);
    } else {
      avatar.appendChild(this.initialsMarker(marker.person.initials));
    }

    const badge = document.createElement('span');
    badge.textContent = marker.person.label;
    badge.style.cssText = `background:${accentColor};border:2px solid rgba(255,255,255,.92);border-radius:${Math.round(9 * size.scale)}px;color:#fff;font:900 ${size.destinationBadgeFont}px/1 "DM Sans",sans-serif;letter-spacing:0;margin-top:-${Math.round(4 * size.scale)}px;max-width:${Math.round(118 * size.scale)}px;overflow:hidden;padding:${Math.round(6 * size.scale)}px ${Math.round(9 * size.scale)}px;text-overflow:ellipsis;white-space:nowrap;`;

    wrapper.append(avatar, badge);
    return wrapper;
  }

  private destinationMarkerSize(): DestinationMarkerSize {
    const zoom = this.currentZoomLevel();
    const factor =
      zoom <= 15
        ? 0.76
        : zoom <= 16
          ? 0.82
          : zoom <= 17
            ? 0.88
            : zoom <= 18
              ? 0.92
              : zoom <= 19
                ? 0.96
                : 1;

    return {
      bodyGap: Math.max(3, Math.round(4 * factor)),
      cardMinHeight: Math.round(62 * factor),
      cardWidth: Math.round(232 * factor),
      destinationAvatar: Math.round(48 * factor),
      destinationBadgeFont: Math.max(11, Math.round(13 * factor)),
      etaBox: Math.round(48 * factor),
      etaRadius: Math.round(9 * factor),
      etaUnitFont: Math.max(8, Math.round(9 * factor)),
      etaUnitMargin: Math.max(2, Math.round(3 * factor)),
      etaValueFont: Math.round(21 * factor),
      gap: Math.round(10 * factor),
      paddingLeft: Math.round(8 * factor),
      paddingRight: Math.round(12 * factor),
      paddingY: Math.round(7 * factor),
      pointer: Math.round(12 * factor),
      radius: Math.round(18 * factor),
      shadowBlur: Math.round(18 * factor),
      shadowY: Math.round(10 * factor),
      scale: factor,
      subtitleFont: Math.max(9, Math.round(10 * factor)),
      titleFont: Math.max(12, Math.round(13 * factor)),
    };
  }

  private splitEtaLabel(label: string): { value: string; unit: string } {
    const normalized = label.trim();
    if (!normalized || normalized === '-- min') return { value: '--', unit: 'MIN' };
    if (/sur place|arrive/i.test(normalized)) return { value: '0', unit: 'MIN' };

    const match = normalized.match(/^(\d+|--)\s*(min|mn|m)?$/i);
    if (!match) return { value: normalized, unit: 'MIN' };

    return {
      value: match[1],
      unit: (match[2] || 'MIN').toUpperCase(),
    };
  }

  private markerPosition(marker: GoogleMapsAdvancedMarkerInstance): GoogleMapsPoint | null {
    const position = marker.position;
    if (!position) return null;
    const latitude = position.lat;
    const longitude = position.lng;
    if (typeof latitude === 'function' && typeof longitude === 'function') {
      return { lat: latitude(), lng: longitude() };
    }
    return typeof latitude === 'number' && typeof longitude === 'number'
      ? { lat: latitude, lng: longitude }
      : null;
  }

  private resolveHeading(position: GoogleMapsPoint, state: TrackingMapRenderState): number {
    const movementMeters = this.lastProviderPosition
      ? this.distanceMeters(this.lastProviderPosition, position)
      : Number.POSITIVE_INFINITY;
    const moving =
      movementMeters >= MARKER_STATIONARY_RADIUS_METERS ||
      ((state.speedKmh ?? 0) >= 3 && movementMeters >= 1.5);

    if (!moving && this.lastProviderPosition) {
      return this.confirmStationaryHeading(state.headingDegrees);
    }
    this.pendingStationaryHeading = null;
    this.pendingStationaryHeadingConfirmations = 0;

    let candidateHeading: number | null = null;
    let alignedToRoute = false;
    const selectedRoute = state.routes.find((route) => route.selected);
    const hasReliableGpsHeading =
      moving &&
      (state.speedKmh ?? 0) >= 8 &&
      typeof state.headingDegrees === 'number' &&
      Number.isFinite(state.headingDegrees);
    if (hasReliableGpsHeading) {
      candidateHeading = this.normalizeHeading(state.headingDegrees as number);
    }
    if (candidateHeading === null && moving && selectedRoute) {
      candidateHeading = this.headingAlongRoute(position, selectedRoute.coordinates);
      alignedToRoute = candidateHeading !== null;
    }

    if (
      candidateHeading === null &&
      moving &&
      typeof state.headingDegrees === 'number' &&
      Number.isFinite(state.headingDegrees)
    ) {
      candidateHeading = this.normalizeHeading(state.headingDegrees);
    }

    if (candidateHeading === null) {
      candidateHeading =
        this.lastProviderPosition && moving
          ? this.bearing(this.lastProviderPosition, position)
          : null;
    }

    if (candidateHeading === null) return this.currentTravelerHeading || 90;
    if (!this.lastProviderPosition) return candidateHeading;
    const delta = ((candidateHeading - this.currentTravelerHeading + 540) % 360) - 180;
    const smoothing = alignedToRoute
      ? (state.speedKmh ?? 0) >= 20
        ? 0.94
        : 0.84
      : (state.speedKmh ?? 0) >= 20
        ? 0.78
        : 0.62;
    return this.normalizeHeading(this.currentTravelerHeading + delta * smoothing);
  }

  private confirmStationaryHeading(headingDegrees: number | null): number {
    if (typeof headingDegrees !== 'number' || !Number.isFinite(headingDegrees)) {
      return this.currentTravelerHeading;
    }

    const candidate = this.normalizeHeading(headingDegrees);
    const delta = ((candidate - this.currentTravelerHeading + 540) % 360) - 180;
    if (Math.abs(delta) < 10) {
      this.pendingStationaryHeading = null;
      this.pendingStationaryHeadingConfirmations = 0;
      return this.currentTravelerHeading;
    }

    if (
      this.pendingStationaryHeading !== null &&
      this.headingDifference(this.pendingStationaryHeading, candidate) <= 12
    ) {
      this.pendingStationaryHeadingConfirmations += 1;
    } else {
      this.pendingStationaryHeading = candidate;
      this.pendingStationaryHeadingConfirmations = 1;
    }

    if (this.pendingStationaryHeadingConfirmations < 2) {
      return this.currentTravelerHeading;
    }

    this.pendingStationaryHeading = candidate;
    return this.normalizeHeading(this.currentTravelerHeading + delta * 0.62);
  }

  private headingAlongRoute(
    position: GoogleMapsPoint,
    coordinates: GoogleMapsPoint[],
  ): number | null {
    if (coordinates.length < 2) return null;

    const projection = this.projectPointToRoute(position, coordinates);
    if (!projection) return null;
    if (projection.distanceFromRouteMeters > ROUTE_SNAP_MAX_DISTANCE_METERS) return null;

    const lookAhead =
      this.routePointAhead(projection.point, coordinates, 12) ??
      coordinates[Math.min(projection.segmentIndex + 1, coordinates.length - 1)];

    if (!lookAhead || this.distanceMeters(projection.point, lookAhead) < 1) {
      const segmentStart = coordinates[projection.segmentIndex];
      const segmentEnd = coordinates[Math.min(projection.segmentIndex + 1, coordinates.length - 1)];
      return segmentStart && segmentEnd && this.distanceMeters(segmentStart, segmentEnd) >= 1
        ? this.bearing(segmentStart, segmentEnd)
        : null;
    }

    return this.bearing(projection.point, lookAhead);
  }

  private visibleRouteHeading(position: GoogleMapsPoint): number | null {
    const selectedRoute = this.lastRenderedState?.routes.find((route) => route.selected);
    const projection = this.projectionOverlay?.getProjection();
    if (!selectedRoute || !projection) return null;

    const routeTarget = this.routePointAhead(position, selectedRoute.coordinates, 12);
    if (!routeTarget) return null;
    const startPixel = projection.fromLatLngToDivPixel(position);
    const targetPixel = projection.fromLatLngToDivPixel(routeTarget);
    if (!startPixel || !targetPixel) return null;

    const deltaX = targetPixel.x - startPixel.x;
    const deltaY = targetPixel.y - startPixel.y;
    if (Math.hypot(deltaX, deltaY) < 1) return null;
    return this.normalizeHeading((Math.atan2(deltaX, -deltaY) * 180) / Math.PI);
  }

  private headingRelativeToCamera(headingDegrees: number): number {
    const mapHeading = this.routeMap?.getHeading?.();
    const renderedCameraHeading =
      typeof mapHeading === 'number' && Number.isFinite(mapHeading)
        ? this.normalizeHeading(mapHeading)
        : this.topViewEnabled
          ? 0
          : this.currentCameraHeading;
    return this.normalizeHeading(headingDegrees - renderedCameraHeading);
  }

  private bearing(from: GoogleMapsPoint, to: GoogleMapsPoint): number {
    const fromLat = (from.lat * Math.PI) / 180;
    const toLat = (to.lat * Math.PI) / 180;
    const longitudeDelta = ((to.lng - from.lng) * Math.PI) / 180;
    const y = Math.sin(longitudeDelta) * Math.cos(toLat);
    const x =
      Math.cos(fromLat) * Math.sin(toLat) -
      Math.sin(fromLat) * Math.cos(toLat) * Math.cos(longitudeDelta);
    return this.normalizeHeading((Math.atan2(y, x) * 180) / Math.PI);
  }

  private pointAtBearing(
    origin: GoogleMapsPoint,
    headingDegrees: number,
    distanceMeters: number,
  ): GoogleMapsPoint {
    const earthRadius = 6_371_000;
    const angularDistance = distanceMeters / earthRadius;
    const heading = (this.normalizeHeading(headingDegrees) * Math.PI) / 180;
    const latitude = (origin.lat * Math.PI) / 180;
    const longitude = (origin.lng * Math.PI) / 180;
    const targetLatitude = Math.asin(
      Math.sin(latitude) * Math.cos(angularDistance) +
        Math.cos(latitude) * Math.sin(angularDistance) * Math.cos(heading),
    );
    const targetLongitude =
      longitude +
      Math.atan2(
        Math.sin(heading) * Math.sin(angularDistance) * Math.cos(latitude),
        Math.cos(angularDistance) - Math.sin(latitude) * Math.sin(targetLatitude),
      );
    return {
      lat: (targetLatitude * 180) / Math.PI,
      lng: (targetLongitude * 180) / Math.PI,
    };
  }

  private headingDifference(from: number, to: number): number {
    const difference = Math.abs(this.normalizeHeading(to) - this.normalizeHeading(from));
    return Math.min(difference, 360 - difference);
  }

  private distanceMeters(from: GoogleMapsPoint, to: GoogleMapsPoint): number {
    const earthRadius = 6_371_000;
    const latitudeDelta = ((to.lat - from.lat) * Math.PI) / 180;
    const longitudeDelta = ((to.lng - from.lng) * Math.PI) / 180;
    const fromLatitude = (from.lat * Math.PI) / 180;
    const toLatitude = (to.lat * Math.PI) / 180;
    const haversine =
      Math.sin(latitudeDelta / 2) ** 2 +
      Math.cos(fromLatitude) * Math.cos(toLatitude) * Math.sin(longitudeDelta / 2) ** 2;
    return earthRadius * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
  }

  private normalizeHeading(value: number): number {
    return ((value % 360) + 360) % 360;
  }

  private cancelAnimation(): void {
    if (this.animationFrameId !== null && typeof cancelAnimationFrame !== 'undefined') {
      cancelAnimationFrame(this.animationFrameId);
    }
    this.animationFrameId = null;
  }

  private cancelCameraAnimation(): void {
    if (this.cameraAnimationFrameId !== null && typeof cancelAnimationFrame !== 'undefined') {
      cancelAnimationFrame(this.cameraAnimationFrameId);
    }
    this.cameraAnimationFrameId = null;
  }

  private clearListeners(instance: object | undefined): void {
    if (instance) {
      this.google?.maps.event?.clearInstanceListeners(instance);
    }
  }
}
