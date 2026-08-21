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
  showAlternativeRoutes?: boolean;
  showManeuverMarkers?: boolean;
  routeCalculating?: boolean;
  routeMatchMode?: 'MATCHED' | 'SUSPECTED_OFF_ROUTE' | 'REROUTING' | 'JOINING_ROUTE';
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
const NAVIGATION_MIN_ZOOM = 15;
const MAP_MAX_ZOOM = 21;
const ROUTE_SNAP_MAX_DISTANCE_METERS = 80;
const MARKER_STATIONARY_RADIUS_METERS = 4;
const MARKER_DEFAULT_UPDATE_INTERVAL_MS = 1000;
const MARKER_PREDICTION_FULL_MS = 250;
const MARKER_PREDICTION_FADE_MS = 500;
const MARKER_BAD_ACCURACY_METERS = 45;
const MARKER_VELOCITY_RESPONSE_PER_SECOND = 5.5;
const MARKER_POSITION_CORRECTION_SECONDS = 0.8;
const MARKER_MAX_FRAME_DELTA_SECONDS = 0.05;
const CAMERA_MOTION_MIN_DURATION_MS = 220;
const CAMERA_MOTION_MAX_DURATION_MS = 1_200;
const MANEUVER_MARKER_MIN_SPACING_METERS = 24;
const MANEUVER_MARKER_LIMIT = 48;
const ROUTE_TURN_DOT_MIN_ANGLE_DEGREES = 14;
const ROUTE_TURN_DOT_MIN_SEGMENT_METERS = 7;
const ROUTE_STROKE_MIN_WEIGHT = 12;
const ROUTE_STROKE_MAX_WEIGHT = 24;
const CAMERA_DEFAULT_UPDATE_INTERVAL_MS = 1_000;
const CAMERA_CENTER_MIN_SPEED_MPS = 12;
const CAMERA_CENTER_SPEED_FACTOR = 1.8;
const CAMERA_CENTER_SPEED_MARGIN_MPS = 8;
const CAMERA_PROGRAMMATIC_ZOOM_EPSILON = 0.08;
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

export type NavigationCameraMode =
  | 'FOLLOWING'
  | 'FREE'
  | 'RECENTERING'
  | 'OVERVIEW'
  | 'ARRIVAL';

@Injectable()
export class TrackingGoogleMapRendererService {
  private readonly loader = inject(GoogleMapsLoaderService);
  private google?: GoogleMapsRuntime;
  private routeMap?: GoogleMapsMapInstance;
  private routeMapElement?: HTMLElement;
  private projectionOverlay?: GoogleMapsOverlayViewInstance;
  private providerMarker?: GoogleMapsAdvancedMarkerInstance;
  private destinationMarker?: GoogleMapsAdvancedMarkerInstance;
  private routeOutlinePolylines: GoogleMapsPolylineInstance[] = [];
  private routePolylines: GoogleMapsPolylineInstance[] = [];
  private selectedRoutePolylineIndex = -1;
  private lastBoundsKey = '';
  private animationFrameId: number | null = null;
  private lastMarkerUpdateAt: number | null = null;
  private lastMarkerSourceAt: number | null = null;
  private renderedMarkerHeading = 0;
  private renderedRouteProgressMeters: number | null = null;
  private renderedRouteProgressKey = '';
  private targetRouteProgressMeters: number | null = null;
  private currentMarkerVelocityMps = 0;
  private targetMarkerVelocityMps = 0;
  private lastMarkerFrameTimestamp: number | null = null;
  private lastMarkerGpsReceivedAt: number | null = null;
  private markerExpectedGpsIntervalMs = MARKER_DEFAULT_UPDATE_INTERVAL_MS;
  private markerRouteCoordinates: GoogleMapsPoint[] = [];
  private markerFreeTarget: GoogleMapsPoint | null = null;
  private markerTargetHeading = 0;
  private markerAccuracyMeters: number | null = null;
  private markerStationary = false;
  private markerMotionMarker?: GoogleMapsAdvancedMarkerInstance;
  private matchedRouteSegmentIndex: number | null = null;
  private mapMatchConfidence = 0;
  private cameraAnimationFrameId: number | null = null;
  private lastCameraUpdateAt: number | null = null;
  private lastCameraSourceAt: number | null = null;
  private renderedCameraCenter: GoogleMapsPoint | null = null;
  private renderedCameraHeading = 0;
  private renderedCameraZoom: number = NAVIGATION_CAMERA_ZOOM;
  private renderedCameraTilt: number = NAVIGATION_CAMERA_TILT;
  private cameraAnchoredToTraveler = false;
  private cameraTargetCenter: GoogleMapsPoint | null = null;
  private cameraTargetHeading = 0;
  private cameraTargetZoom: number = NAVIGATION_CAMERA_ZOOM;
  private cameraTargetTilt: number = NAVIGATION_CAMERA_TILT;
  private cameraTargetSpeedKmh = 0;
  private userCameraZoom: number | null = null;
  private lastCameraFrameTimestamp: number | null = null;
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
  private cameraMode: NavigationCameraMode = 'FOLLOWING';

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
    this.routeMap.addListener('zoom_changed', () => {
      if (this.applyingCameraUpdate) return;
      const zoom = this.routeMap?.getZoom?.();
      if (typeof zoom === 'number' && Number.isFinite(zoom)) {
        // Google Maps peut publier zoom_changed apres la fin synchrone de
        // moveCamera(). Ne jamais memoriser notre propre frame RAF comme un
        // choix utilisateur, sinon une valeur intermediaire eloignee bloque
        // definitivement la vue conducteur.
        if (!this.shouldCaptureUserZoom(zoom)) return;
        this.userCameraZoom = zoom;
        this.cameraTargetZoom = zoom;
        this.renderedCameraZoom = zoom;
        this.enterFreeCameraMode();
      }
    });
    this.routeMap.addListener('dragstart', () => this.enterFreeCameraMode());
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
      this.updateCameraModeForRender(state.arrived);
      this.showManeuverMarkers = state.showManeuverMarkers === true;
      // Le GPS filtre reste la source de verite pour detecter une deviation.
      // En mode navigation, le rendu reste strictement colle a la route choisie.
      const displayedProvider = state.arrived
        ? state.provider
        : this.snapTravelerMarkerToSelectedRoute(state.provider, state);
      this.routeMap.setOptions?.({
        // Pendant le trajet, le zoom minimal protege la camera de navigation.
        // Une fois arrive, rendre toute l'amplitude au geste utilisateur pour
        // explorer la carte sans que la camera paraisse verrouillee.
        minZoom: state.arrived ? TOP_VIEW_MIN_ZOOM : this.minimumZoom(),
        gestureHandling: 'greedy',
      });
      this.currentTravelerHeading = this.resolveHeading(state.provider, state);
      if (!this.topViewEnabled) {
        this.currentCameraHeading = this.currentTravelerHeading;
      }
      this.lastRenderedState = state;
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
      // Le GPS entrant est la cible du moteur RAF, pas encore la position
      // visible. Ancrer le corridor sur le marqueur effectivement rendu evite
      // que le trace parte devant lui pendant qu'il rattrape sa cible.
      const renderedProvider = this.markerPosition(this.providerMarker) ?? displayedProvider;
      this.lastRenderedProviderPosition = renderedProvider;
      if (state.destination) {
        this.destinationMarker = this.upsertDestinationMarker(
          this.destinationMarker,
          this.routeMap,
          state.destination,
          state.destinationMarker,
        );
      }
      const routesAllowedForViewer = this.routesAllowedForViewer(state);
      const visibleRoutes = state.arrived
        ? []
        : this.routesStartingAtProvider(renderedProvider, routesAllowedForViewer);
      this.renderRoutes(visibleRoutes);
      // La vue globale doit cadrer la geometrie complete et stable. Utiliser
      // la route raccourcie au rythme du marqueur changeait la cle a chaque
      // GPS et relancait fitBounds en boucle, donnant l'impression que la
      // carte courait toute seule a grande vitesse.
      const cameraRoutes = this.topViewEnabled ? routesAllowedForViewer : visibleRoutes;
      this.fitRoute(
        renderedProvider,
        state.destination,
        cameraRoutes,
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

    const leavingTopView = this.topViewEnabled && !enabled;
    this.cancelCameraAnimation();
    this.topViewEnabled = enabled;
    this.cameraMode = enabled ? 'OVERVIEW' : 'RECENTERING';
    this.userCameraZoom = null;
    this.lastBoundsKey = '';
    if (leavingTopView) {
      // Le centre courant appartient au fitBounds de la vue globale et peut
      // etre situe a plusieurs kilometres du vehicule. Ne jamais le faire
      // traverser lentement par le moteur anti-saut : le prochain render
      // initialise directement le referentiel conducteur sur le marqueur.
      this.renderedCameraCenter = null;
      this.cameraTargetCenter = null;
      this.lastCameraFrameTimestamp = null;
      this.cameraAnchoredToTraveler = false;
    }
    if (leavingTopView) {
      // Ne pas appliquer le tilt/zoom conducteur sur l'ancien centre global :
      // cela produirait une frame 3D visible loin du vehicule. Le render juste
      // apres applique centre, cap, zoom et tilt ensemble sur le marqueur.
      this.routeMap?.setOptions?.({
        minZoom: this.minimumZoom(),
        maxZoom: MAP_MAX_ZOOM,
        headingInteractionEnabled: false,
        tiltInteractionEnabled: false,
        gestureHandling: 'greedy',
      });
    } else {
      this.applyImmersiveCamera();
    }
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
    this.cameraTargetHeading = heading;
    this.cameraTargetZoom = this.cameraZoom();
    this.cameraTargetTilt = this.cameraTilt();
    const center = this.routeMap?.getCenter?.();
    if (!this.renderedCameraCenter && center) {
      this.renderedCameraCenter = { lat: center.lat(), lng: center.lng() };
    }
    if (!this.cameraTargetCenter && this.renderedCameraCenter) {
      this.cameraTargetCenter = this.renderedCameraCenter;
    }
    this.routeMap?.moveCamera?.({
      heading,
      tilt: this.cameraTargetTilt,
      zoom: this.cameraTargetZoom,
    });
    this.renderedCameraHeading = heading;
    this.applyCssRotationFallback(0);
    this.refreshRenderedTravelerMarker();
  }

  recenterNavigationCamera(): void {
    if (this.topViewEnabled) this.topViewEnabled = false;
    this.cameraMode = 'RECENTERING';
    this.userCameraZoom = null;
    this.lastBoundsKey = '';
    this.cameraAnchoredToTraveler = false;
    if (this.lastRenderedState) this.render(this.lastRenderedState);
  }

  getCameraMode(): NavigationCameraMode {
    return this.cameraMode;
  }

  private enterFreeCameraMode(): void {
    if (this.topViewEnabled || this.cameraMode === 'OVERVIEW' || this.cameraMode === 'ARRIVAL') return;
    this.cameraMode = 'FREE';
    this.cameraTargetCenter = this.renderedCameraCenter;
    this.cameraTargetHeading = this.renderedCameraHeading;
    this.cameraTargetZoom = this.renderedCameraZoom;
    this.cameraTargetTilt = this.renderedCameraTilt;
  }

  private updateCameraModeForRender(arrived: boolean): void {
    if (arrived) {
      this.cameraMode = 'ARRIVAL';
    } else if (this.topViewEnabled) {
      this.cameraMode = 'OVERVIEW';
    } else if (this.cameraMode === 'ARRIVAL' || this.cameraMode === 'OVERVIEW') {
      this.cameraMode = 'RECENTERING';
    }
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
    return this.topViewEnabled
      ? TOP_VIEW_CAMERA_ZOOM
      : (this.userCameraZoom ?? NAVIGATION_CAMERA_ZOOM);
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

  private shouldCaptureUserZoom(zoom: number): boolean {
    return (
      Math.abs(zoom - this.cameraTargetZoom) > CAMERA_PROGRAMMATIC_ZOOM_EPSILON &&
      Math.abs(zoom - this.renderedCameraZoom) > CAMERA_PROGRAMMATIC_ZOOM_EPSILON
    );
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
    this.renderedRouteProgressMeters = null;
    this.renderedRouteProgressKey = '';
    this.resetContinuousMarkerMotion();
    this.currentTravelerHeading = 0;
    this.pendingStationaryHeading = null;
    this.pendingStationaryHeadingConfirmations = 0;
    this.renderedCameraCenter = null;
    this.renderedCameraHeading = 0;
    this.renderedCameraZoom = NAVIGATION_CAMERA_ZOOM;
    this.renderedCameraTilt = NAVIGATION_CAMERA_TILT;
    this.resetContinuousCameraMotion();
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
    this.selectedRoutePolylineIndex = -1;
    this.renderedRouteForIcons = null;
    this.lastRenderedState = null;
    this.navigationCamera.reset();
    this.navigationCameraDecision = null;
    this.userCameraZoom = null;
    this.lastRenderedProviderPosition = null;
    this.lastProviderPosition = null;
    this.lastMarkerUpdateAt = null;
    this.lastMarkerSourceAt = null;
    this.renderedMarkerHeading = 0;
    this.renderedRouteProgressMeters = null;
    this.renderedRouteProgressKey = '';
    this.resetContinuousMarkerMotion();
    this.resetContinuousCameraMotion();
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
    while (this.routeOutlinePolylines.length > visibleRoutes.length) {
      this.routeOutlinePolylines.pop()?.setMap(null);
    }

    if (visibleRoutes.length === 0) {
      this.renderedRouteForIcons = null;
      this.selectedRoutePolylineIndex = -1;
      return;
    }

    this.renderedRouteForIcons = visibleRoutes.find((route) => route.selected) ?? null;
    this.selectedRoutePolylineIndex = visibleRoutes.findIndex((route) => route.selected);
    visibleRoutes.forEach((route, index) => {
      const selected = route.selected;
      const routeWeight = this.routeStrokeWeight();
      const fillWeight = selected ? Math.max(12, routeWeight + 2) : Math.max(5, routeWeight - 3);
      const outlineOptions = {
        map: this.routeMap,
        path: route.coordinates,
        strokeColor: selected ? '#0d8f65' : this.alternativeRouteOutlineColor(index),
        strokeOpacity: selected ? 0.98 : 0.42,
        strokeWeight: fillWeight + (selected ? 5 : 3),
        zIndex: selected ? 19 : 9,
        clickable: true,
      };
      const options = {
        map: this.routeMap,
        path: route.coordinates,
        icons: selected ? this.routeManeuverIconSequences(route) : [],
        strokeColor: selected ? '#1eb980' : this.alternativeRouteColor(index),
        strokeOpacity: selected ? 1 : 0.62,
        strokeWeight: fillWeight,
        zIndex: selected ? 20 : 10,
        clickable: true,
      };
      let outline = this.routeOutlinePolylines[index];
      if (!outline) {
        outline = new this.google!.maps.Polyline(outlineOptions);
        this.routeOutlinePolylines[index] = outline;
      } else {
        outline.setOptions(outlineOptions);
        outline.setPath(route.coordinates);
        outline.setMap(this.routeMap as GoogleMapsMapInstance);
      }
      let polyline = this.routePolylines[index];
      if (!polyline) {
        polyline = new this.google!.maps.Polyline(options);
        this.routePolylines[index] = polyline;
      } else {
        polyline.setOptions(options);
        polyline.setPath(route.coordinates);
        polyline.setMap(this.routeMap as GoogleMapsMapInstance);
      }
      this.google!.maps.event?.clearInstanceListeners(outline);
      outline.addListener('click', () => this.routeSelected?.(route.id));
      this.google!.maps.event?.clearInstanceListeners(polyline);
      polyline.addListener('click', () => this.routeSelected?.(route.id));
    });
  }

  private routesAllowedForViewer(state: TrackingMapRenderState): TrackingMapRoute[] {
    return state.showAlternativeRoutes === false
      ? state.routes.filter((route) => route.selected)
      : state.routes;
  }

  private alternativeRouteColor(index: number): string {
    const colors = ['#86dcb8', '#a3e5c8', '#72cfaa', '#b8ead5'];
    return colors[Math.max(0, index - 1) % colors.length];
  }

  private alternativeRouteOutlineColor(index: number): string {
    const colors = ['#5dbd94', '#78cda8', '#4eb689', '#8fd4b7'];
    return colors[Math.max(0, index - 1) % colors.length];
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
    const selectedIndex = this.selectedRoutePolylineIndex;
    if (selectedIndex < 0) return;
    const fillWeight = Math.max(12, this.routeStrokeWeight() + 2);
    this.routeOutlinePolylines[selectedIndex]?.setOptions({
      strokeWeight: fillWeight + 5,
    });
    this.routePolylines[selectedIndex]?.setOptions({
      strokeWeight: fillWeight,
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
      this.lastRenderedState.routeCalculating === true,
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
      const createdMarker = new AdvancedMarkerElement({
        map,
        position,
        title: 'Prestataire en route',
        content: this.providerMarkerContent(
          heading,
          position,
          state.travelerMarker,
          state.routeCalculating === true,
        ),
        anchorLeft: '-50%',
        anchorTop: this.providerMarkerAnchorTop(state.travelerMarker),
        // Toujours au-dessus du corridor, de son contour et des points de
        // manoeuvre : la route rejoint le bord du marqueur sans le traverser.
        zIndex: 100,
      });
      this.updateContinuousMarkerTarget(
        createdMarker,
        position,
        heading,
        state.speedKmh,
        state.accuracyMeters,
        state.positionTimestampMs,
        state.routeMatchMode === 'REROUTING' || state.routeMatchMode === 'JOINING_ROUTE'
          ? null
          : (state.routes.find((route) => route.selected) ?? null),
      );
      return createdMarker;
    }

    this.applyProviderMarkerAnchor(marker, state.travelerMarker);
    marker.content = this.providerMarkerContent(
      this.renderedMarkerHeading,
      position,
      state.travelerMarker,
      state.routeCalculating === true,
    );
    if (state.arrived) {
      this.cancelAnimation();
      marker.position = position;
      this.setMarkerHeading(marker, heading);
      this.renderedMarkerHeading = heading;
      this.lastMarkerUpdateAt = this.animationClock();
      this.lastMarkerSourceAt = this.validTimestamp(state.positionTimestampMs);
    } else {
      this.animateMarker(
        marker,
        position,
        heading,
        state.speedKmh,
        state.accuracyMeters,
        state.positionTimestampMs,
        state.routeMatchMode === 'REROUTING' || state.routeMatchMode === 'JOINING_ROUTE'
          ? null
          : (state.routes.find((route) => route.selected) ?? null),
      );
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
      // L'AdvancedMarker ancre le conteneur complet (shell + marge), pas
      // uniquement le cercle visible. -50% place donc le centre exact du
      // cercle sur la coordonnee projetee, quel que soit le zoom.
      return '-50%';
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
    accuracyMeters: number | null | undefined,
    sourceTimestampMs: number | null | undefined,
    selectedRoute: TrackingMapRoute | null,
  ): void {
    this.updateContinuousMarkerTarget(
      marker,
      destination,
      destinationHeading,
      speedKmh,
      accuracyMeters,
      sourceTimestampMs,
      selectedRoute,
    );
  }

  private updateContinuousMarkerTarget(
    marker: GoogleMapsAdvancedMarkerInstance,
    destination: GoogleMapsPoint,
    destinationHeading: number,
    speedKmh: number | null | undefined,
    accuracyMeters: number | null | undefined,
    sourceTimestampMs: number | null | undefined,
    selectedRoute: TrackingMapRoute | null,
  ): void {
    const current = this.markerPosition(marker) ?? destination;
    if (typeof requestAnimationFrame === 'undefined') {
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
    if (sourceInterval !== null && sourceInterval > 200 && sourceInterval < 5_000) {
      this.markerExpectedGpsIntervalMs =
        this.markerExpectedGpsIntervalMs * 0.7 + sourceInterval * 0.3;
    }
    const routeCoordinates = selectedRoute?.coordinates ?? [];
    const routeProgressKey = selectedRoute ? this.routeInterpolationKey(selectedRoute) : '';
    const originProjection = this.projectPointToRoute(current, routeCoordinates);
    const sameRouteReference = routeProgressKey === this.renderedRouteProgressKey;
    const destinationProjection = this.projectPointToRoute(
      destination,
      routeCoordinates,
      sameRouteReference ? this.renderedRouteProgressMeters : null,
      sameRouteReference ? this.matchedRouteSegmentIndex : null,
    );
    this.markerFreeTarget = routeCoordinates.length >= 2 ? null : destination;
    if (routeProgressKey !== this.renderedRouteProgressKey) {
      this.renderedRouteProgressKey = routeProgressKey;
      // Un rerouting change le referentiel metrique. Remapper la position
      // actuellement affichee sur la nouvelle polyline sans annuler la boucle
      // ni remettre la vitesse a zero.
      this.renderedRouteProgressMeters = originProjection?.distanceAlongRouteMeters ?? null;
      this.matchedRouteSegmentIndex = originProjection?.segmentIndex ?? null;
    }
    const originProgress = this.monotonicRouteProgress(
      originProjection?.distanceAlongRouteMeters ?? 0,
      this.renderedRouteProgressMeters ?? 0,
    );
    const movementMeters = this.distanceMeters(current, destination);
    const holdStationaryPosition = this.shouldHoldMarkerPosition(
      movementMeters,
      speedKmh,
      accuracyMeters,
    );
    const destinationProgress = holdStationaryPosition
      ? originProgress
      : this.monotonicRouteProgress(
          originProgress,
          destinationProjection?.distanceAlongRouteMeters ?? originProgress,
        );
    const measuredVelocityMps =
      typeof speedKmh === 'number' && Number.isFinite(speedKmh) && speedKmh >= 0
        ? speedKmh / 3.6
        : updateInterval > 0
          ? (routeCoordinates.length >= 2
              ? Math.max(0, destinationProgress - originProgress)
              : movementMeters) /
            (updateInterval / 1_000)
          : this.targetMarkerVelocityMps;
    const smoothedVelocity = holdStationaryPosition
      ? 0
      : this.targetMarkerVelocityMps > 0
        ? this.targetMarkerVelocityMps * 0.35 + measuredVelocityMps * 0.65
        : measuredVelocityMps;

    this.markerMotionMarker = marker;
    this.markerRouteCoordinates = routeCoordinates;
    this.targetRouteProgressMeters = destinationProgress;
    this.matchedRouteSegmentIndex = destinationProjection?.segmentIndex ?? this.matchedRouteSegmentIndex;
    // La confiance a deja ete calculee dans snapTravelerMarkerToSelectedRoute
    // depuis le GPS brut. `destination` peut etre le point projete utilise
    // pour le rendu : le reprojeter ici donnerait artificiellement confiance 1.
    this.targetMarkerVelocityMps = smoothedVelocity;
    this.markerStationary = holdStationaryPosition;
    if (holdStationaryPosition) this.currentMarkerVelocityMps = 0;
    this.markerTargetHeading = destinationHeading;
    this.markerAccuracyMeters =
      typeof accuracyMeters === 'number' && Number.isFinite(accuracyMeters)
        ? accuracyMeters
        : null;
    this.lastMarkerGpsReceivedAt = receivedAt;
    if (this.renderedRouteProgressMeters === null) {
      this.renderedRouteProgressMeters = originProgress;
    }
    this.ensureContinuousMarkerLoop();
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

  private ensureContinuousMarkerLoop(): void {
    if (this.animationFrameId !== null || typeof requestAnimationFrame === 'undefined') return;
    this.lastMarkerFrameTimestamp = null;
    this.animationFrameId = requestAnimationFrame((timestamp) =>
      this.runContinuousMarkerFrame(timestamp),
    );
  }

  private runContinuousMarkerFrame(timestamp: number): void {
    const marker = this.markerMotionMarker;
    const currentProgress = this.renderedRouteProgressMeters;
    if (!marker) {
      this.animationFrameId = requestAnimationFrame((nextTimestamp) =>
        this.runContinuousMarkerFrame(nextTimestamp),
      );
      return;
    }

    const previousTimestamp = this.lastMarkerFrameTimestamp ?? timestamp;
    const deltaSeconds = Math.min(
      MARKER_MAX_FRAME_DELTA_SECONDS,
      Math.max(0, (timestamp - previousTimestamp) / 1_000),
    );
    this.lastMarkerFrameTimestamp = timestamp;

    if (this.markerRouteCoordinates.length < 2 || currentProgress === null) {
      this.runFreeMarkerFrame(marker, deltaSeconds, timestamp);
      this.animationFrameId = requestAnimationFrame((nextTimestamp) =>
        this.runContinuousMarkerFrame(nextTimestamp),
      );
      return;
    }

    const predictionFactor = this.markerPredictionFactor(timestamp);
    const targetProgress = this.targetRouteProgressMeters ?? currentProgress;
    const progressError = targetProgress - currentProgress;
    const correctionVelocity = Math.max(0, progressError / MARKER_POSITION_CORRECTION_SECONDS);
    const desiredVelocity =
      Math.max(this.targetMarkerVelocityMps, correctionVelocity) * predictionFactor;
    const maxUsefulVelocity = Math.max(3, this.targetMarkerVelocityMps * 2.5 + 6);
    const boundedVelocity = Math.min(maxUsefulVelocity, desiredVelocity);
    const velocityBlend = Math.min(1, deltaSeconds * MARKER_VELOCITY_RESPONSE_PER_SECOND);
    this.currentMarkerVelocityMps +=
      (boundedVelocity - this.currentMarkerVelocityMps) * velocityBlend;

    const nextProgress = this.monotonicRouteProgress(
      currentProgress,
      currentProgress + this.currentMarkerVelocityMps * deltaSeconds,
    );
    this.renderedRouteProgressMeters = nextProgress;
    const nextPosition = this.pointAlongRouteAtDistance(
      this.markerRouteCoordinates,
      nextProgress,
    );
    if (nextPosition) {
      marker.position = nextPosition;
      this.lastRenderedProviderPosition = nextPosition;
      this.synchronizeRouteAndCameraWithMarker(nextPosition, nextProgress);
    }

    const headingDelta = shortestAngleDelta(
      this.renderedMarkerHeading,
      this.markerTargetHeading,
    );
    const headingBlend = Math.min(1, deltaSeconds * 7);
    this.renderedMarkerHeading = this.normalizeHeading(
      this.renderedMarkerHeading + headingDelta * headingBlend,
    );
    this.setMarkerHeading(marker, this.renderedMarkerHeading);

    this.animationFrameId = requestAnimationFrame((nextTimestamp) =>
      this.runContinuousMarkerFrame(nextTimestamp),
    );
  }

  private runFreeMarkerFrame(
    marker: GoogleMapsAdvancedMarkerInstance,
    deltaSeconds: number,
    timestamp: number,
  ): void {
    const current = this.markerPosition(marker);
    const target = this.markerFreeTarget;
    if (!current || !target) return;

    const remainingMeters = this.distanceMeters(current, target);
    if (remainingMeters > 0.05) {
      const predictionFactor = this.markerPredictionFactor(timestamp);
      const correctionVelocity = remainingMeters / MARKER_POSITION_CORRECTION_SECONDS;
      const desiredVelocity = Math.max(this.targetMarkerVelocityMps, correctionVelocity);
      const maxUsefulVelocity = Math.max(3, this.targetMarkerVelocityMps * 2.5 + 6);
      const velocityBlend = Math.min(1, deltaSeconds * MARKER_VELOCITY_RESPONSE_PER_SECOND);
      this.currentMarkerVelocityMps +=
        (Math.min(maxUsefulVelocity, desiredVelocity) * predictionFactor -
          this.currentMarkerVelocityMps) *
        velocityBlend;
      const stepMeters = Math.min(remainingMeters, this.currentMarkerVelocityMps * deltaSeconds);
      const ratio = remainingMeters > 0 ? stepMeters / remainingMeters : 1;
      const nextPosition = {
        lat: current.lat + (target.lat - current.lat) * ratio,
        lng: current.lng + (target.lng - current.lng) * ratio,
      };
      marker.position = nextPosition;
      this.lastRenderedProviderPosition = nextPosition;
      if (!this.topViewEnabled) {
        // Pendant un recalcul, conserver le decalage avant du vehicule au lieu
        // de rabattre la camera sur le marqueur a chaque frame. La carte suit
        // ainsi le GPS libre sans perdre brutalement son look-ahead.
        this.cameraTargetCenter = this.cameraTargetCenter
          ? {
              lat: this.cameraTargetCenter.lat + (nextPosition.lat - current.lat),
              lng: this.cameraTargetCenter.lng + (nextPosition.lng - current.lng),
            }
          : nextPosition;
      }
    }

    const headingDelta = shortestAngleDelta(
      this.renderedMarkerHeading,
      this.markerTargetHeading,
    );
    this.renderedMarkerHeading = this.normalizeHeading(
      this.renderedMarkerHeading + headingDelta * Math.min(1, deltaSeconds * 7),
    );
    this.setMarkerHeading(marker, this.renderedMarkerHeading);
  }

  private markerPredictionFactor(frameTimestamp: number): number {
    if (this.lastMarkerGpsReceivedAt === null || this.markerStationary) return 0;
    const overdueMs = Math.max(
      0,
      frameTimestamp - this.lastMarkerGpsReceivedAt - this.markerExpectedGpsIntervalMs,
    );
    let factor = 1;
    if (overdueMs > MARKER_PREDICTION_FULL_MS) {
      factor = Math.max(
        0,
        1 -
          (overdueMs - MARKER_PREDICTION_FULL_MS) /
            (MARKER_PREDICTION_FADE_MS - MARKER_PREDICTION_FULL_MS),
      );
    }
    if (
      this.markerAccuracyMeters !== null &&
      this.markerAccuracyMeters > MARKER_BAD_ACCURACY_METERS
    ) {
      return 0;
    }
    return factor;
  }

  private synchronizeRouteAndCameraWithMarker(
    markerPosition: GoogleMapsPoint,
    progressMeters: number,
  ): void {
    const remainingRoute = this.routeCoordinatesAfterProgress(
      this.markerRouteCoordinates,
      progressMeters,
    );
    if (remainingRoute.length >= 2 && this.selectedRoutePolylineIndex >= 0) {
      this.routeOutlinePolylines[this.selectedRoutePolylineIndex]?.setPath(remainingRoute);
      this.routePolylines[this.selectedRoutePolylineIndex]?.setPath(remainingRoute);
      if (this.renderedRouteForIcons) {
        this.renderedRouteForIcons = {
          ...this.renderedRouteForIcons,
          coordinates: remainingRoute,
        };
      }
    }

    if (this.topViewEnabled || !this.navigationCameraDecision) return;
    if (this.markerStationary && this.renderedCameraCenter) {
      this.cameraTargetCenter = this.renderedCameraCenter;
      return;
    }
    const lookAheadPoint = this.pointAlongRouteAtDistance(
      this.markerRouteCoordinates,
      progressMeters + this.navigationCameraDecision.lookAheadMeters,
    );
    if (!lookAheadPoint) {
      this.cameraTargetCenter = markerPosition;
      return;
    }
    // NavigationCameraEngine decide deja la distance de look-ahead. Une
    // seconde ponderation ici raccourcissait artificiellement la route future.
    this.cameraTargetCenter = lookAheadPoint;
  }

  private routeCoordinatesAfterProgress(
    coordinates: GoogleMapsPoint[],
    progressMeters: number,
  ): GoogleMapsPoint[] {
    const start = this.routePointAtDistance(coordinates, Math.max(0, progressMeters));
    if (!start) return coordinates;
    const remaining = coordinates.slice(start.nextIndex);
    const first = remaining[0];
    return first && this.distanceMeters(start.point, first) < 0.05
      ? remaining
      : [start.point, ...remaining];
  }

  private shouldHoldMarkerPosition(
    movementMeters: number,
    speedKmh: number | null | undefined,
    accuracyMeters: number | null | undefined,
  ): boolean {
    const accuracy =
      typeof accuracyMeters === 'number' && Number.isFinite(accuracyMeters)
        ? accuracyMeters
        : null;
    if (accuracy !== null && accuracy > MARKER_BAD_ACCURACY_METERS) return true;
    const stationaryRadius = Math.max(
      MARKER_STATIONARY_RADIUS_METERS,
      Math.min(12, (accuracy ?? 8) * 0.6),
    );
    const hasReliableSpeed =
      typeof speedKmh === 'number' && Number.isFinite(speedKmh) && speedKmh >= 0;
    if (hasReliableSpeed) {
      if (speedKmh <= 2) return true;
      if (speedKmh <= 6) return movementMeters <= stationaryRadius;
      return false;
    }
    return movementMeters <= stationaryRadius;
  }

  private resetContinuousMarkerMotion(): void {
    this.cancelAnimation();
    this.targetRouteProgressMeters = null;
    this.currentMarkerVelocityMps = 0;
    this.targetMarkerVelocityMps = 0;
    this.lastMarkerFrameTimestamp = null;
    this.lastMarkerGpsReceivedAt = null;
    this.markerExpectedGpsIntervalMs = MARKER_DEFAULT_UPDATE_INTERVAL_MS;
    this.markerRouteCoordinates = [];
    this.markerFreeTarget = null;
    this.markerTargetHeading = 0;
    this.markerAccuracyMeters = null;
    this.markerStationary = false;
    this.markerMotionMarker = undefined;
    this.matchedRouteSegmentIndex = null;
    this.mapMatchConfidence = 0;
  }

  private linearMotionProgress(elapsedMs: number, durationMs: number): number {
    if (durationMs <= 0) return 1;
    return Math.min(1, Math.max(0, elapsedMs / durationMs));
  }

  private monotonicRouteProgress(previousMeters: number, candidateMeters: number): number {
    return Math.max(previousMeters, candidateMeters);
  }

  private cameraMotionDuration(updateIntervalMs: number): number {
    return Math.min(
      CAMERA_MOTION_MAX_DURATION_MS,
      Math.max(CAMERA_MOTION_MIN_DURATION_MS, updateIntervalMs * 0.95),
    );
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
    if (this.cameraMode === 'FREE') return;
    if (this.cameraMode === 'ARRIVAL' && destination) {
      const key = `arrival:${provider.lat.toFixed(6)}:${provider.lng.toFixed(6)}:${destination.lat.toFixed(6)}:${destination.lng.toFixed(6)}`;
      if (key === this.lastBoundsKey) return;
      this.lastBoundsKey = key;
      this.cancelCameraAnimation();
      this.withCameraUpdate(() => {
        const bounds = new this.google!.maps.LatLngBounds();
        bounds.extend(provider);
        bounds.extend(destination);
        this.routeMap?.fitBounds(bounds, TOP_VIEW_ROUTE_PADDING);
        this.routeMap?.setHeading?.(0);
        this.routeMap?.setTilt?.(0);
      });
      return;
    }
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
      this.lastRenderedState?.routeMatchMode === 'REROUTING' ||
      this.lastRenderedState?.routeMatchMode === 'JOINING_ROUTE'
      ? []
      : (routes.find((route) => route.selected)?.coordinates ?? routes[0]?.coordinates ?? []);
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
      this.navigationCameraDecision?.headingDegrees ?? this.currentCameraHeading,
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
    if (!this.routeMap || this.cameraMode === 'FREE' || this.cameraMode === 'OVERVIEW') return;
    const requestedHeading = this.normalizeHeading(targetHeadingDegrees);
    const requestedHeadingDelta = shortestAngleDelta(this.renderedCameraHeading, requestedHeading);
    let targetHeading =
      Math.abs(requestedHeadingDelta) < 1.5 ? this.renderedCameraHeading : requestedHeading;
    let targetZoom = this.topViewEnabled
      ? TOP_VIEW_CAMERA_ZOOM
      : (this.userCameraZoom ?? this.navigationCameraZoom(speedKmh));
    let targetTilt = this.topViewEnabled
      ? TOP_VIEW_CAMERA_TILT
      : this.navigationCameraTilt(speedKmh);
    let stableTargetCenter = targetCenter;
    // Une fois l'arret confirme par le meme moteur que le marqueur, ne pas
    // laisser la camera terminer seule un ancien look-ahead. Centre, cap,
    // zoom et tilt restent exactement sur leur frame visible jusqu'au premier
    // mouvement GPS fiable suivant.
    if (
      !this.topViewEnabled &&
      this.markerStationary &&
      this.cameraAnchoredToTraveler &&
      this.renderedCameraCenter
    ) {
      stableTargetCenter = this.renderedCameraCenter;
      // A l'arret, ignorer le compas instable mais autoriser la route matchee
      // a aligner la vue une fois dans la vraie direction de circulation.
      if (this.mapMatchConfidence < 0.75) {
        targetHeading = this.renderedCameraHeading;
      }
      targetZoom = this.renderedCameraZoom;
      targetTilt = this.renderedCameraTilt;
    }
    const sourceAt = this.validTimestamp(sourceTimestampMs);
    this.lastCameraUpdateAt = this.animationClock();
    if (sourceAt !== null) this.lastCameraSourceAt = sourceAt;
    this.cameraTargetCenter = stableTargetCenter;
    this.cameraTargetHeading = targetHeading;
    this.cameraTargetZoom = targetZoom;
    this.cameraTargetTilt = targetTilt;
    this.cameraTargetSpeedKmh = Math.max(0, speedKmh ?? 0);
    if (!this.cameraAnchoredToTraveler || !this.renderedCameraCenter) {
      this.withCameraUpdate(() => {
        this.routeMap?.moveCamera?.({
          center: stableTargetCenter,
          heading: targetHeading,
          zoom: targetZoom,
          tilt: targetTilt,
        });
      });
      this.renderedCameraCenter = stableTargetCenter;
      this.renderedCameraHeading = targetHeading;
      this.renderedCameraZoom = targetZoom;
      this.renderedCameraTilt = targetTilt;
      this.cameraAnchoredToTraveler = true;
    }
    this.ensureContinuousCameraLoop();
  }

  private ensureContinuousCameraLoop(): void {
    if (this.cameraAnimationFrameId !== null || typeof requestAnimationFrame === 'undefined') return;
    this.lastCameraFrameTimestamp = null;
    this.cameraAnimationFrameId = requestAnimationFrame((timestamp) =>
      this.runContinuousCameraFrame(timestamp),
    );
  }

  private runContinuousCameraFrame(timestamp: number): void {
    if (this.cameraMode === 'FREE' || this.cameraMode === 'OVERVIEW' || this.cameraMode === 'ARRIVAL') {
      this.cameraAnimationFrameId = requestAnimationFrame((nextTimestamp) =>
        this.runContinuousCameraFrame(nextTimestamp),
      );
      return;
    }
    if (!this.routeMap || !this.cameraTargetCenter || !this.renderedCameraCenter) {
      this.cameraAnimationFrameId = requestAnimationFrame((nextTimestamp) =>
        this.runContinuousCameraFrame(nextTimestamp),
      );
      return;
    }
    const previousTimestamp = this.lastCameraFrameTimestamp ?? timestamp;
    const deltaSeconds = Math.min(0.05, Math.max(0, (timestamp - previousTimestamp) / 1_000));
    this.lastCameraFrameTimestamp = timestamp;
    // Reponse plus douce que le marqueur, mais sans fin d'animation entre GPS.
    const blend = 1 - Math.exp(-4.2 * deltaSeconds);
    const center = this.boundedCameraCenterStep(
      this.renderedCameraCenter,
      this.cameraTargetCenter,
      blend,
      deltaSeconds,
    );
    const heading = this.normalizeHeading(
      this.renderedCameraHeading +
        shortestAngleDelta(this.renderedCameraHeading, this.cameraTargetHeading) * blend,
    );
    const zoom = this.renderedCameraZoom + (this.cameraTargetZoom - this.renderedCameraZoom) * blend;
    const tilt = this.renderedCameraTilt + (this.cameraTargetTilt - this.renderedCameraTilt) * blend;
    this.withCameraUpdate(() => {
      this.routeMap?.moveCamera?.({ center, heading, zoom, tilt });
    });
    this.renderedCameraCenter = center;
    this.renderedCameraHeading = heading;
    this.renderedCameraZoom = zoom;
    this.renderedCameraTilt = tilt;
    if (
      this.cameraMode === 'RECENTERING' &&
      this.distanceMeters(center, this.cameraTargetCenter) < 1.5 &&
      Math.abs(shortestAngleDelta(heading, this.cameraTargetHeading)) < 1
    ) {
      this.cameraMode = 'FOLLOWING';
    }
    this.cameraAnimationFrameId = requestAnimationFrame((nextTimestamp) =>
      this.runContinuousCameraFrame(nextTimestamp),
    );
  }

  private resetContinuousCameraMotion(): void {
    this.cancelCameraAnimation();
    this.cameraTargetCenter = null;
    this.cameraTargetHeading = 0;
    this.cameraTargetZoom = NAVIGATION_CAMERA_ZOOM;
    this.cameraTargetTilt = NAVIGATION_CAMERA_TILT;
    this.cameraTargetSpeedKmh = 0;
    this.cameraAnchoredToTraveler = false;
    this.lastCameraFrameTimestamp = null;
  }

  private boundedCameraCenterStep(
    current: GoogleMapsPoint,
    target: GoogleMapsPoint,
    blend: number,
    deltaSeconds: number,
  ): GoogleMapsPoint {
    const distanceMeters = this.distanceMeters(current, target);
    if (distanceMeters <= 0.01 || deltaSeconds <= 0) return current;

    const desiredStepMeters = distanceMeters * blend;
    const vehicleSpeedMps = this.cameraTargetSpeedKmh / 3.6;
    const maximumSpeedMps = Math.max(
      CAMERA_CENTER_MIN_SPEED_MPS,
      vehicleSpeedMps * CAMERA_CENTER_SPEED_FACTOR + CAMERA_CENTER_SPEED_MARGIN_MPS,
    );
    const stepMeters = Math.min(distanceMeters, desiredStepMeters, maximumSpeedMps * deltaSeconds);
    const ratio = stepMeters / distanceMeters;
    return {
      lat: current.lat + (target.lat - current.lat) * ratio,
      lng: current.lng + (target.lng - current.lng) * ratio,
    };
  }

  private navigationCameraCenter(
    provider: GoogleMapsPoint,
    routeCoordinates: GoogleMapsPoint[],
    headingDegrees: number,
    speedKmh: number | null | undefined,
    accuracyMeters: number | null | undefined,
    nextManeuverDistanceMeters: number | null,
  ): GoogleMapsPoint {
    const routeGeometry = this.routeCameraGeometry(provider, routeCoordinates);
    const input = {
      position: provider,
      headingDegrees,
      speedKmh,
      accuracyMeters,
      routeTarget: null,
      routeBearingDegrees: routeGeometry.currentBearing,
      futureRouteBearingDegrees: routeGeometry.futureBearing,
      routeConfidence: routeGeometry.confidence,
      nextManeuverDistanceMeters,
      viewportWidthPx: this.routeMapElement?.clientWidth ?? null,
      viewportHeightPx: this.routeMapElement?.clientHeight ?? null,
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

  private routeCameraGeometry(
    provider: GoogleMapsPoint,
    routeCoordinates: GoogleMapsPoint[],
  ): { currentBearing: number | null; futureBearing: number | null; confidence: number } {
    const projection = this.projectPointToRoute(
      provider,
      routeCoordinates,
      this.renderedRouteProgressMeters,
      this.matchedRouteSegmentIndex,
    );
    if (!projection || projection.distanceFromRouteMeters > ROUTE_SNAP_MAX_DISTANCE_METERS) {
      return { currentBearing: null, futureBearing: null, confidence: 0 };
    }
    const progress = projection.distanceAlongRouteMeters;
    const at10 = this.pointAlongRouteAtDistance(routeCoordinates, progress + 10);
    const at20 = this.pointAlongRouteAtDistance(routeCoordinates, progress + 20);
    const at40 = this.pointAlongRouteAtDistance(routeCoordinates, progress + 40);
    const currentBearing = at10 ? this.bearing(projection.point, at10) : null;
    const futureBearing = at20 && at40 ? this.bearing(at20, at40) : currentBearing;
    return {
      currentBearing,
      futureBearing,
      confidence: Math.max(
        this.mapMatchConfidence,
        Math.max(0, 1 - projection.distanceFromRouteMeters / ROUTE_SNAP_MAX_DISTANCE_METERS),
      ),
    };
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

    const projection = this.projectPointToRoute(
      provider,
      routeCoordinates,
      this.renderedRouteProgressMeters,
      this.matchedRouteSegmentIndex,
    );
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
    preferredProgressMeters: number | null = null,
    preferredSegmentIndex: number | null = null,
  ): RouteProjection | null {
    if (routeCoordinates.length < 2) return null;

    let nearestProjection: RouteProjection | null = null;
    let bestScore = Number.POSITIVE_INFINITY;
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
      const candidateProgress = distanceBeforeSegment + segmentMeters * segmentProjection.ratio;
      const backwardPenalty =
        preferredProgressMeters !== null && candidateProgress + 8 < preferredProgressMeters
          ? Math.min(120, preferredProgressMeters - candidateProgress)
          : 0;
      const segmentContinuityPenalty =
        preferredSegmentIndex === null ? 0 : Math.min(24, Math.abs(index - preferredSegmentIndex) * 4);
      const score = distanceFromRouteMeters + backwardPenalty + segmentContinuityPenalty;

      if (!nearestProjection || score < bestScore) {
        bestScore = score;
        nearestProjection = {
          point: projectedPoint,
          segmentIndex: index,
          ratio: segmentProjection.ratio,
          distanceAlongRouteMeters: candidateProgress,
          distanceFromRouteMeters,
        };
      }

      distanceBeforeSegment += segmentMeters;
    }

    return nearestProjection;
  }

  private snapTravelerMarkerToSelectedRoute(
    position: GoogleMapsPoint,
    state: TrackingMapRenderState,
  ): GoogleMapsPoint {
    if (state.routeMatchMode === 'REROUTING' || state.routeMatchMode === 'JOINING_ROUTE') {
      this.mapMatchConfidence = 0;
      return position;
    }
    const route = state.routes.find((candidate) => candidate.selected);
    if (!route || route.coordinates.length < 2) return position;
    const projection = this.projectPointToRoute(
      position,
      route.coordinates,
      this.renderedRouteProgressMeters,
      this.matchedRouteSegmentIndex,
    );
    if (!projection) return position;
    const accuracy = Math.max(5, state.accuracyMeters ?? 20);
    const speed = Math.max(0, state.speedKmh ?? 0);
    const adaptiveSnapThreshold = Math.min(
      ROUTE_SNAP_MAX_DISTANCE_METERS,
      Math.max(12, accuracy * 1.25 + Math.min(18, speed * 0.12)),
    );
    if (projection.distanceFromRouteMeters > adaptiveSnapThreshold) {
      this.mapMatchConfidence = 0;
      return position;
    }
    this.matchedRouteSegmentIndex = projection.segmentIndex;
    this.mapMatchConfidence = Math.max(
      0,
      1 - projection.distanceFromRouteMeters / ROUTE_SNAP_MAX_DISTANCE_METERS,
    );
    return projection.point;
  }

  private snapPointToRoute(
    position: GoogleMapsPoint,
    routeCoordinates: GoogleMapsPoint[],
  ): GoogleMapsPoint {
    if (routeCoordinates.length < 2) return position;
    const projection = this.projectPointToRoute(position, routeCoordinates);
    return projection?.point ?? position;
  }

  private pointAlongRouteAtDistance(
    routeCoordinates: GoogleMapsPoint[],
    distanceMeters: number,
  ): GoogleMapsPoint | null {
    return this.routePointAtDistance(routeCoordinates, Math.max(0, distanceMeters))?.point ?? null;
  }

  private routeInterpolationKey(route: TrackingMapRoute): string {
    return `${route.id}:${this.routeCameraKey(route.coordinates)}`;
  }

  private clearDestinationMarker(): void {
    if (this.destinationMarker) {
      this.destinationMarker.map = null;
    }
    this.destinationMarker = undefined;
  }

  private clearRoutePolylines(): void {
    this.routeOutlinePolylines.forEach((polyline) => polyline.setMap(null));
    this.routeOutlinePolylines = [];
    this.routePolylines.forEach((polyline) => polyline.setMap(null));
    this.routePolylines = [];
    this.selectedRoutePolylineIndex = -1;
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
    routeCalculating = false,
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
    traveler.appendChild(this.travelerMarkerVisual(travelerMarker, routeCalculating));

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
    badge.style.cssText = `background:${accentColor};border:2px solid rgba(255,255,255,.92);border-radius:10px;color:#fff;font:900 13px/1 Inter,sans-serif;letter-spacing:0;margin-top:-4px;max-width:116px;overflow:hidden;padding:6px 9px;text-overflow:ellipsis;white-space:nowrap;`;
    return badge;
  }

  private travelerMarkerVisual(
    marker: TrackingTravelerMarker,
    routeCalculating = false,
  ): HTMLElement {
    if (marker.kind === 'navigation') {
      const size = this.navigationMarkerSize();
      const shell = document.createElement('span');
      shell.setAttribute('aria-label', marker.name || 'Navigation');
      if (routeCalculating) {
        shell.className = 'jokko-tracking-navigation-dot';
        shell.style.cssText = `align-items:center;background-color:rgba(134,82,33,0.22);border-radius:999px;display:flex;height:${size.shell}px;justify-content:center;width:${size.shell}px;`;
        const dot = document.createElement('span');
        dot.className = 'jokko-tracking-navigation-dot-core';
        dot.setAttribute('aria-hidden', 'true');
        dot.style.cssText = `background-color:#865221;border:3px solid #fff;border-radius:999px;box-shadow:0 2px 5px rgba(15,23,42,0.35);box-sizing:border-box;display:block;height:${size.icon}px;width:${size.icon}px;`;
        shell.appendChild(dot);
        return shell;
      }

      shell.className = 'jokko-tracking-navigation-arrow';
      shell.style.cssText = `align-items:center;background-color:#fff;border:1px solid rgba(15,23,42,0.1);border-radius:999px;box-shadow:0 9px 18px rgba(15,23,42,0.22);box-sizing:border-box;display:flex;height:${size.shell}px;isolation:isolate;justify-content:center;overflow:hidden;width:${size.shell}px;`;
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('viewBox', '0 0 64 64');
      svg.setAttribute('width', String(size.icon));
      svg.setAttribute('height', String(size.icon));
      svg.setAttribute('aria-hidden', 'true');
      svg.style.cssText = 'display:block;filter:drop-shadow(0 2px 2px rgba(15,23,42,.24));transform:translateY(-1px);transform-origin:50% 50%;';
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
      icon: Math.round(shell * 0.7),
    };
  }

  private initialsMarker(initials: string): HTMLElement {
    const fallback = document.createElement('span');
    fallback.textContent = initials || 'JK';
    fallback.style.cssText =
      'align-items:center;color:#0f172a;display:flex;font:900 14px/1 Inter,sans-serif;height:100%;justify-content:center;width:100%;';
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
    card.className = 'jokko-tracking-arrival-card';
    card.style.cssText = `align-items:center;background:#fff;border:1px solid rgba(15,23,42,.08);border-radius:${size.radius}px;box-shadow:0 ${size.shadowY}px ${size.shadowBlur}px rgba(15,23,42,.18);display:flex;gap:${size.gap}px;min-height:${size.cardMinHeight}px;padding:${size.paddingY}px ${size.paddingRight}px ${size.paddingY}px ${size.paddingLeft}px;width:100%;`;

    const etaBox = document.createElement('span');
    etaBox.style.cssText = `align-items:center;background:${accentColor};border-radius:${size.etaRadius}px;color:#fff;display:flex;flex-direction:column;height:${size.etaBox}px;justify-content:center;min-width:${size.etaBox}px;text-transform:uppercase;`;

    const etaValue = document.createElement('strong');
    etaValue.textContent = eta.value;
    etaValue.style.cssText = `font:900 ${size.etaValueFont}px/1 Inter,sans-serif;letter-spacing:0;`;

    const etaUnit = document.createElement('small');
    etaUnit.textContent = eta.unit;
    etaUnit.style.cssText = `font:800 ${size.etaUnitFont}px/1.1 Inter,sans-serif;letter-spacing:0;margin-top:${size.etaUnitMargin}px;opacity:.86;`;

    const body = document.createElement('span');
    body.style.cssText = `display:flex;flex:1;flex-direction:column;gap:${size.bodyGap}px;min-width:0;white-space:nowrap;`;

    const title = document.createElement('strong');
    title.textContent = marker.title;
    title.style.cssText = `color:#111827;font:900 ${size.titleFont}px/1.15 Inter,sans-serif;letter-spacing:0;overflow:hidden;text-overflow:ellipsis;`;

    const subtitle = document.createElement('small');
    subtitle.textContent = marker.subtitle;
    subtitle.style.cssText = `color:#64748b;font:700 ${size.subtitleFont}px/1 Inter,sans-serif;letter-spacing:0;text-transform:uppercase;`;

    body.append(title, subtitle);
    etaBox.append(etaValue, etaUnit);
    card.append(etaBox, body);
    const person = this.destinationPersonContent(marker, size);
    if (person) {
      // Carte du lieu puis avatar et badge : aucun triangle decoratif ne
      // doit apparaitre sous la personne.
      content.append(card, person);
    } else {
      content.append(card);
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
    wrapper.className = 'jokko-tracking-arrival-person';
    wrapper.style.cssText = `align-items:center;display:flex;flex-direction:column;isolation:isolate;margin-top:-${Math.max(6, Math.round(9 * size.scale))}px;`;
    wrapper.style.isolation = 'isolate';
    wrapper.style.marginTop = `-${Math.max(6, Math.round(9 * size.scale))}px`;

    const avatar = document.createElement('span');
    avatar.className = 'jokko-tracking-arrival-avatar';
    avatar.style.cssText = `align-items:center;background:#eff6ff;border:${Math.max(2, Math.round(3 * size.scale))}px solid ${accentColor};border-radius:999px;box-shadow:0 ${Math.round(8 * size.scale)}px ${Math.round(16 * size.scale)}px rgba(15,23,42,.24);display:flex;height:${size.destinationAvatar}px;justify-content:center;overflow:hidden;position:relative;width:${size.destinationAvatar}px;z-index:1;`;
    avatar.style.position = 'relative';
    avatar.style.zIndex = '1';

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
    badge.className = 'jokko-tracking-arrival-role';
    badge.textContent = marker.person.label;
    badge.style.cssText = `background:${accentColor};border:2px solid rgba(255,255,255,.92);border-radius:${Math.round(9 * size.scale)}px;color:#fff;font:900 ${size.destinationBadgeFont}px/1 Inter,sans-serif;letter-spacing:0;margin-top:-${Math.round(4 * size.scale)}px;max-width:${Math.round(118 * size.scale)}px;overflow:hidden;padding:${Math.round(6 * size.scale)}px ${Math.round(9 * size.scale)}px;position:relative;text-overflow:ellipsis;white-space:nowrap;z-index:2;`;
    badge.style.marginTop = `-${Math.round(4 * size.scale)}px`;
    badge.style.position = 'relative';
    badge.style.zIndex = '2';

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

  private markerPosition(
    marker: GoogleMapsAdvancedMarkerInstance | undefined,
  ): GoogleMapsPoint | null {
    if (!marker) return null;
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
    const selectedRoute =
      state.routeMatchMode === 'REROUTING' || state.routeMatchMode === 'JOINING_ROUTE'
      ? undefined
      : state.routes.find((route) => route.selected);
    // Tant que le marqueur est colle au trace, sa direction suit d'abord la
    // tangente de la route. Le cap GPS reste un secours lorsque la geometrie
    // de l'itineraire ne permet pas de calculer une orientation fiable.
    if (moving && selectedRoute) {
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
