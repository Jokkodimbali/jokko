import { Injectable, inject } from '@angular/core';
import {
  GoogleMapsAdvancedMarkerInstance,
  GoogleMapsLoaderService,
  GoogleMapsMapInstance,
  GoogleMapsPoint,
  GoogleMapsPolylineInstance,
  GoogleMapsRuntime,
} from '../../../shared/maps/google-maps-loader.service';

export type TrackingMapRoute = {
  id: string;
  coordinates: GoogleMapsPoint[];
  selected: boolean;
};

export type TrackingTravelerMarker = {
  kind: 'avatar' | 'vehicle';
  imageUrl: string | null;
  initials: string;
  name: string;
  roleLabel: string;
};

export type TrackingMapRenderState = {
  provider: GoogleMapsPoint | null;
  destination: GoogleMapsPoint | null;
  routes: TrackingMapRoute[];
  remainingLabel: string;
  statusLabel: string;
  headingDegrees: number | null;
  arrived: boolean;
  travelerMarker: TrackingTravelerMarker;
};

const DAKAR_CENTER: GoogleMapsPoint = { lat: 14.7167, lng: -17.4677 };
const NAVIGATION_CAMERA_TILT = 67.5;
const NAVIGATION_CAMERA_ZOOM = 18.6;
const TOP_VIEW_CAMERA_TILT = 0;
const TOP_VIEW_CAMERA_ZOOM = 17.4;
const ROUTE_TURN_ARROW_MIN_ANGLE_DEGREES = 28;
const ROUTE_TURN_ARROW_MIN_SPACING_METERS = 45;

type RouteTurnMarker = {
  offsetPercent: number;
};

@Injectable()
export class TrackingGoogleMapRendererService {
  private readonly loader = inject(GoogleMapsLoaderService);
  private google?: GoogleMapsRuntime;
  private routeMap?: GoogleMapsMapInstance;
  private routeMapElement?: HTMLElement;
  private providerMarker?: GoogleMapsAdvancedMarkerInstance;
  private destinationMarker?: GoogleMapsAdvancedMarkerInstance;
  private routePolylines: GoogleMapsPolylineInstance[] = [];
  private lastBoundsKey = '';
  private animationFrameId: number | null = null;
  private routeSelected?: (routeId: string) => void;
  private lastProviderPosition: GoogleMapsPoint | null = null;
  private applyingCameraUpdate = false;
  private controlsStyleElement?: HTMLStyleElement;
  private currentCameraHeading = 0;
  private topViewEnabled = false;

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
    this.hideNativeGoogleMapControls(element);
  }

  render(state: TrackingMapRenderState): void {
    if (!this.google || !state.provider) return;

    if (this.routeMap) {
      if (state.arrived) {
        this.clearDestinationMarker();
        this.clearRoutePolylines();
      }
      this.providerMarker = this.upsertProviderMarker(
        this.providerMarker,
        this.routeMap,
        state.provider,
        state,
      );
      if (!state.arrived && state.destination) {
        this.destinationMarker = this.upsertDestinationMarker(
          this.destinationMarker,
          this.routeMap,
          state.destination,
        );
      }
      const visibleRoutes = state.arrived ? [] : state.routes;
      this.renderRoutes(visibleRoutes);
      this.fitRoute(state.provider, state.arrived ? null : state.destination, visibleRoutes);
    }
  }

  setSatellite(enabled: boolean): void {
    this.routeMap?.setMapTypeId(enabled ? 'hybrid' : 'roadmap');
    this.applyImmersiveCamera();
  }

  setTopView(enabled: boolean): void {
    this.topViewEnabled = enabled;
    this.applyImmersiveCamera();
  }

  setHeading(headingDegrees: number): void {
    const heading = this.normalizeHeading(headingDegrees);
    this.currentCameraHeading = heading;
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
    this.applyCssRotationFallback(0);
  }

  private applyImmersiveCamera(): void {
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
      gestureHandling: 'greedy',
      clickableIcons: true,
    });
    this.routeMap?.setHeading?.(this.currentCameraHeading);
    this.routeMap?.setTilt?.(this.cameraTilt());
    this.routeMap?.moveCamera?.({
      heading: this.currentCameraHeading,
      tilt: this.cameraTilt(),
      zoom: this.cameraZoom(),
    });
  }

  private cameraTilt(): number {
    return this.topViewEnabled ? TOP_VIEW_CAMERA_TILT : NAVIGATION_CAMERA_TILT;
  }

  private cameraZoom(): number {
    return this.topViewEnabled ? TOP_VIEW_CAMERA_ZOOM : NAVIGATION_CAMERA_ZOOM;
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
  }

  destroyRouteMap(): void {
    this.cancelAnimation();
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
    this.routeMap = undefined;
    this.routeMapElement = undefined;
    this.lastBoundsKey = '';
  }

  destroy(): void {
    this.destroyRouteMap();
  }

  private renderRoutes(routes: TrackingMapRoute[]): void {
    if (!this.google || !this.routeMap) return;
    const visibleRoutes = routes.filter((route) => route.selected).slice(0, 1);

    while (this.routePolylines.length > visibleRoutes.length) {
      this.routePolylines.pop()?.setMap(null);
    }

    visibleRoutes.forEach((route) => {
      const options = {
        map: this.routeMap,
        path: route.coordinates,
        icons: this.routeDirectionIcons(route.coordinates),
        strokeColor: '#1eb980',
        strokeOpacity: 0.96,
        strokeWeight: 7,
        zIndex: 20,
        clickable: false,
      };
      let polyline = this.routePolylines[0];
      if (!polyline) {
        polyline = new this.google!.maps.Polyline(options);
        this.routePolylines[0] = polyline;
      } else {
        polyline.setOptions(options);
        polyline.setPath(route.coordinates);
        polyline.setMap(this.routeMap as GoogleMapsMapInstance);
      }
    });
  }

  private routeDirectionIcons(
    coordinates: GoogleMapsPoint[],
  ): Array<Record<string, unknown>> {
    const symbolPath = (this.google?.maps as unknown as {
      SymbolPath?: { FORWARD_CLOSED_ARROW?: unknown };
    })?.SymbolPath?.FORWARD_CLOSED_ARROW;
    if (!symbolPath) return [];

    return this.routeTurnMarkersData(coordinates).map((turn) => ({
      icon: {
        path: symbolPath,
        scale: 2.6,
        strokeColor: '#ffffff',
        strokeOpacity: 0.95,
        strokeWeight: 1.1,
        fillColor: '#1f2937',
        fillOpacity: 0.92,
      },
      offset: `${turn.offsetPercent.toFixed(1)}%`,
    }));
  }

  private routeTurnMarkersData(coordinates: GoogleMapsPoint[]): RouteTurnMarker[] {
    if (coordinates.length < 3) return [];

    const segmentLengths = coordinates.slice(1).map((point, index) =>
      this.distanceMeters(coordinates[index], point),
    );
    const totalDistanceMeters = segmentLengths.reduce(
      (total, length) => total + length,
      0,
    );
    if (totalDistanceMeters <= 0) return [];

    const turns: RouteTurnMarker[] = [];
    let distanceAlongRoute = 0;
    let lastArrowDistance = Number.NEGATIVE_INFINITY;

    for (let index = 1; index < coordinates.length - 1; index += 1) {
      distanceAlongRoute += segmentLengths[index - 1] ?? 0;
      const previousSegmentLength = segmentLengths[index - 1] ?? 0;
      const nextSegmentLength = segmentLengths[index] ?? 0;
      if (
        previousSegmentLength < 8 ||
        nextSegmentLength < 8 ||
        distanceAlongRoute - lastArrowDistance < ROUTE_TURN_ARROW_MIN_SPACING_METERS
      ) {
        continue;
      }

      const previousBearing = this.bearing(coordinates[index - 1], coordinates[index]);
      const nextBearing = this.bearing(coordinates[index], coordinates[index + 1]);
      const turnDegrees = this.signedHeadingDifference(previousBearing, nextBearing);
      if (Math.abs(turnDegrees) < ROUTE_TURN_ARROW_MIN_ANGLE_DEGREES) {
        continue;
      }

      turns.push({
        offsetPercent: Math.min(
          98,
          Math.max(2, (distanceAlongRoute / totalDistanceMeters) * 100),
        ),
      });
      lastArrowDistance = distanceAlongRoute;
    }

    return turns;
  }

  private upsertProviderMarker(
    marker: GoogleMapsAdvancedMarkerInstance | undefined,
    map: GoogleMapsMapInstance,
    position: GoogleMapsPoint,
    state: TrackingMapRenderState,
  ): GoogleMapsAdvancedMarkerInstance {
    const AdvancedMarkerElement =
      this.google?.maps.marker?.AdvancedMarkerElement;
    if (!AdvancedMarkerElement) {
      throw new Error('GOOGLE_MAPS_NOT_INITIALIZED');
    }
    const heading = this.resolveHeading(position, state);
    this.currentCameraHeading = heading;
    if (!marker) {
      this.lastProviderPosition = position;
      return new AdvancedMarkerElement({
        map,
        position,
        title: 'Prestataire en route',
        content: this.providerMarkerContent(
          state.statusLabel,
          state.remainingLabel,
          heading,
          position,
          state.travelerMarker,
        ),
        zIndex: 30,
      });
    }

    marker.content = this.providerMarkerContent(
      state.statusLabel,
      state.remainingLabel,
      heading,
      position,
      state.travelerMarker,
    );
    this.animateMarker(marker, position);
    this.lastProviderPosition = position;
    return marker;
  }

  private upsertDestinationMarker(
    marker: GoogleMapsAdvancedMarkerInstance | undefined,
    map: GoogleMapsMapInstance,
    position: GoogleMapsPoint,
  ): GoogleMapsAdvancedMarkerInstance {
    const AdvancedMarkerElement =
      this.google?.maps.marker?.AdvancedMarkerElement;
    if (!AdvancedMarkerElement) {
      throw new Error('GOOGLE_MAPS_NOT_INITIALIZED');
    }
    if (!marker) {
      return new AdvancedMarkerElement({
        map,
        position,
        title: 'Destination',
        content: this.destinationMarkerContent(),
        zIndex: 25,
      });
    }

    marker.position = position;
    return marker;
  }

  private animateMarker(
    marker: GoogleMapsAdvancedMarkerInstance,
    destination: GoogleMapsPoint,
  ): void {
    const current = this.markerPosition(marker);
    if (!current || typeof requestAnimationFrame === 'undefined') {
      marker.position = destination;
      return;
    }

    this.cancelAnimation();
    const origin = current;
    const startedAt = performance.now();
    const duration = 750;
    const animate = (timestamp: number): void => {
      const progress = Math.min(1, (timestamp - startedAt) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      marker.position = {
        lat: origin.lat + (destination.lat - origin.lat) * eased,
        lng: origin.lng + (destination.lng - origin.lng) * eased,
      };
      if (progress < 1) {
        this.animationFrameId = requestAnimationFrame(animate);
      }
    };
    this.animationFrameId = requestAnimationFrame(animate);
  }

  private fitRoute(
    provider: GoogleMapsPoint,
    destination: GoogleMapsPoint | null,
    routes: TrackingMapRoute[],
  ): void {
    if (!this.google || !this.routeMap) return;
    if (!destination) {
      const key = [
        'provider-only',
        provider.lat.toFixed(6),
        provider.lng.toFixed(6),
        Math.round(this.currentCameraHeading / 4) * 4,
        this.topViewEnabled ? 'top' : 'nav',
      ].join('|');
      if (key === this.lastBoundsKey) return;
      this.lastBoundsKey = key;
      this.withCameraUpdate(() => {
        this.routeMap?.setCenter(provider);
        this.routeMap?.moveCamera?.({
          center: provider,
          zoom: this.cameraZoom(),
          tilt: this.cameraTilt(),
          heading: this.currentCameraHeading,
        });
        this.routeMap?.setZoom(this.cameraZoom());
      });
      return;
    }

    const selectedRouteCoordinates =
      routes.find((route) => route.selected)?.coordinates ??
      routes[0]?.coordinates ??
      [];
    const focus = this.navigationFocusPoint(provider, selectedRouteCoordinates);
    const key = [
      focus.lat.toFixed(6),
      focus.lng.toFixed(6),
      Math.round(this.currentCameraHeading / 4) * 4,
      selectedRouteCoordinates.length,
      this.topViewEnabled ? 'top' : 'nav',
    ].join('|');
    if (key === this.lastBoundsKey) return;
    this.lastBoundsKey = key;
    this.withCameraUpdate(() => {
      this.routeMap?.moveCamera?.({
        center: focus,
        zoom: this.cameraZoom(),
        tilt: this.cameraTilt(),
        heading: this.currentCameraHeading,
      });
      this.routeMap?.setCenter(focus);
      this.routeMap?.setZoom(this.cameraZoom());
      this.routeMap?.setHeading?.(this.currentCameraHeading);
      this.routeMap?.setTilt?.(this.cameraTilt());
    });
  }

  private navigationFocusPoint(
    provider: GoogleMapsPoint,
    routeCoordinates: GoogleMapsPoint[],
  ): GoogleMapsPoint {
    const lookAhead = this.routePointAhead(provider, routeCoordinates, 110);
    if (!lookAhead) {
      return provider;
    }

    return {
      lat: provider.lat * 0.62 + lookAhead.lat * 0.38,
      lng: provider.lng * 0.62 + lookAhead.lng * 0.38,
    };
  }

  private routePointAhead(
    provider: GoogleMapsPoint,
    routeCoordinates: GoogleMapsPoint[],
    lookAheadMeters: number,
  ): GoogleMapsPoint | null {
    if (routeCoordinates.length < 2) {
      return null;
    }

    let nearestIndex = 0;
    let nearestDistance = Number.POSITIVE_INFINITY;
    routeCoordinates.forEach((coordinate, index) => {
      const distance =
        Math.pow(coordinate.lat - provider.lat, 2) +
        Math.pow(coordinate.lng - provider.lng, 2);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestIndex = index;
      }
    });

    let coveredMeters = 0;
    for (let index = nearestIndex + 1; index < routeCoordinates.length; index += 1) {
      const start = routeCoordinates[index - 1];
      const end = routeCoordinates[index];
      const segmentMeters = this.distanceMeters(start, end);
      if (coveredMeters + segmentMeters >= lookAheadMeters) {
        const ratio =
          segmentMeters <= 0 ? 1 : (lookAheadMeters - coveredMeters) / segmentMeters;
        return {
          lat: start.lat + (end.lat - start.lat) * ratio,
          lng: start.lng + (end.lng - start.lng) * ratio,
        };
      }
      coveredMeters += segmentMeters;
    }

    return routeCoordinates[routeCoordinates.length - 1];
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
    statusLabel: string,
    remainingLabel: string,
    headingDegrees: number,
    position: GoogleMapsPoint,
    travelerMarker: TrackingTravelerMarker,
  ): HTMLElement {
    const content = document.createElement('div');
    content.className = 'jokko-tracking-taxi-marker';
    content.dataset['latitude'] = String(position.lat);
    content.dataset['longitude'] = String(position.lng);
    content.style.cssText =
      'display:grid;justify-items:center;gap:3px;transform:translateY(-8px);pointer-events:none;';

    const bubble = document.createElement('div');
    bubble.textContent = statusLabel;
    bubble.style.cssText =
      'max-width:280px;padding:8px 12px;border:1px solid rgba(15,23,42,.12);border-radius:10px;background:#fff;color:#111827;box-shadow:0 10px 24px rgba(15,23,42,.2);font:850 12px/1.28 "DM Sans",sans-serif;text-align:center;white-space:normal;';

    const pointer = document.createElement('span');
    pointer.style.cssText =
      'width:8px;height:8px;margin-top:-7px;background:#fff;border-right:1px solid rgba(15,23,42,.12);border-bottom:1px solid rgba(15,23,42,.12);transform:rotate(45deg);';

    const traveler = document.createElement('div');
    const markerHeading = this.normalizeHeading(
      headingDegrees - this.currentCameraHeading,
    );
    traveler.style.cssText =
      travelerMarker.kind === 'vehicle'
        ? `align-items:center;background:transparent;border:0;display:flex;height:104px;justify-content:center;overflow:visible;transform:rotate(${markerHeading}deg);transform-origin:50% 55%;transition:transform 500ms ease;width:124px;`
        : 'align-items:center;background:#eff6ff;border:3px solid #2f80ff;border-radius:999px;box-shadow:0 10px 20px rgba(15,23,42,.28);display:flex;height:52px;justify-content:center;overflow:hidden;transform-origin:50% 50%;transition:transform 500ms ease;width:52px;';
    traveler.appendChild(this.travelerMarkerVisual(travelerMarker));

    const badge = document.createElement('span');
    badge.textContent =
      travelerMarker.kind === 'vehicle'
        ? remainingLabel || travelerMarker.roleLabel
        : travelerMarker.roleLabel || remainingLabel;
    badge.style.cssText =
      `margin-top:${travelerMarker.kind === 'vehicle' ? '-20px' : '-8px'};max-width:140px;overflow:hidden;padding:5px 10px;border-radius:999px;background:${travelerMarker.kind === 'vehicle' ? '#111827' : '#2f80ff'};color:#fff;font:900 12px/1 "DM Sans",sans-serif;box-shadow:0 4px 10px rgba(15,23,42,.25);text-overflow:ellipsis;white-space:nowrap;`;

    content.append(bubble, pointer, traveler, badge);
    return content;
  }

  private travelerMarkerVisual(marker: TrackingTravelerMarker): HTMLElement {
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

  private initialsMarker(initials: string): HTMLElement {
    const fallback = document.createElement('span');
    fallback.textContent = initials || 'JK';
    fallback.style.cssText =
      'align-items:center;color:#0f172a;display:flex;font:900 14px/1 "DM Sans",sans-serif;height:100%;justify-content:center;width:100%;';
    return fallback;
  }

  private destinationMarkerContent(): HTMLElement {
    return this.markerContent(
      `
        <svg xmlns="http://www.w3.org/2000/svg" width="42" height="50" viewBox="0 0 42 50">
          <path d="M21 2C10.5 2 2 10.5 2 21c0 13 19 27 19 27s19-14 19-27C40 10.5 31.5 2 21 2z" fill="#568d42" stroke="white" stroke-width="3"/>
          <circle cx="21" cy="21" r="7" fill="white"/>
        </svg>`,
      'jokko-tracking-marker jokko-tracking-marker--destination',
    );
  }

  private markerContent(svg: string, className: string): HTMLElement {
    const content = document.createElement('div');
    content.className = className;
    content.innerHTML = svg;
    return content;
  }

  private markerPosition(
    marker: GoogleMapsAdvancedMarkerInstance,
  ): GoogleMapsPoint | null {
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

  private resolveHeading(
    position: GoogleMapsPoint,
    state: TrackingMapRenderState,
  ): number {
    if (
      typeof state.headingDegrees === 'number' &&
      Number.isFinite(state.headingDegrees)
    ) {
      return this.normalizeHeading(state.headingDegrees);
    }

    const selectedRoute = state.routes.find((route) => route.selected);
    const routeHeading = selectedRoute
      ? this.headingAlongRoute(position, selectedRoute.coordinates)
      : null;
    if (routeHeading !== null) {
      return routeHeading;
    }

    return this.lastProviderPosition
      ? this.bearing(this.lastProviderPosition, position)
      : 90;
  }

  private headingAlongRoute(
    position: GoogleMapsPoint,
    coordinates: GoogleMapsPoint[],
  ): number | null {
    if (coordinates.length < 2) return null;

    let nearestIndex = 0;
    let nearestDistance = Number.POSITIVE_INFINITY;
    coordinates.forEach((coordinate, index) => {
      const distance =
        Math.pow(coordinate.lat - position.lat, 2) +
        Math.pow(coordinate.lng - position.lng, 2);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestIndex = index;
      }
    });

    const nextIndex = Math.min(nearestIndex + 1, coordinates.length - 1);
    const previousIndex = Math.max(0, nextIndex - 1);
    if (nextIndex === previousIndex) return null;
    return this.bearing(coordinates[previousIndex], coordinates[nextIndex]);
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

  private distanceMeters(from: GoogleMapsPoint, to: GoogleMapsPoint): number {
    const earthRadius = 6_371_000;
    const latitudeDelta = ((to.lat - from.lat) * Math.PI) / 180;
    const longitudeDelta = ((to.lng - from.lng) * Math.PI) / 180;
    const fromLatitude = (from.lat * Math.PI) / 180;
    const toLatitude = (to.lat * Math.PI) / 180;
    const haversine =
      Math.sin(latitudeDelta / 2) ** 2 +
      Math.cos(fromLatitude) *
        Math.cos(toLatitude) *
        Math.sin(longitudeDelta / 2) ** 2;
    return earthRadius * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
  }

  private normalizeHeading(value: number): number {
    return ((value % 360) + 360) % 360;
  }

  private headingDifference(from: number, to: number): number {
    const difference = Math.abs(this.normalizeHeading(to) - this.normalizeHeading(from));
    return Math.min(difference, 360 - difference);
  }

  private signedHeadingDifference(from: number, to: number): number {
    const difference = this.normalizeHeading(to) - this.normalizeHeading(from);
    return ((difference + 540) % 360) - 180;
  }

  private cancelAnimation(): void {
    if (
      this.animationFrameId !== null &&
      typeof cancelAnimationFrame !== 'undefined'
    ) {
      cancelAnimationFrame(this.animationFrameId);
    }
    this.animationFrameId = null;
  }

  private clearListeners(instance: object | undefined): void {
    if (instance) {
      this.google?.maps.event?.clearInstanceListeners(instance);
    }
  }
}
