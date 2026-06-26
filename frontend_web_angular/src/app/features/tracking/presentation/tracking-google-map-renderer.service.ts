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

export type TrackingMapRenderState = {
  provider: GoogleMapsPoint | null;
  destination: GoogleMapsPoint | null;
  routes: TrackingMapRoute[];
  remainingLabel: string;
  statusLabel: string;
  headingDegrees: number | null;
};

const DAKAR_CENTER: GoogleMapsPoint = { lat: 14.7167, lng: -17.4677 };

@Injectable()
export class TrackingGoogleMapRendererService {
  private readonly loader = inject(GoogleMapsLoaderService);
  private google?: GoogleMapsRuntime;
  private routeMap?: GoogleMapsMapInstance;
  private routeMapElement?: HTMLElement;
  private providerMarker?: GoogleMapsAdvancedMarkerInstance;
  private destinationMarker?: GoogleMapsAdvancedMarkerInstance;
  private routePolylines: GoogleMapsPolylineInstance[] = [];
  private userInteracted = false;
  private lastBoundsKey = '';
  private animationFrameId: number | null = null;
  private routeSelected?: (routeId: string) => void;
  private lastProviderPosition: GoogleMapsPoint | null = null;

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
      zoom: 13,
      heading: 0,
      tilt: 0,
      renderingType: 'VECTOR',
      mapTypeId: satellite ? 'satellite' : 'roadmap',
      disableDefaultUI: true,
      zoomControl: true,
      clickableIcons: false,
      gestureHandling: 'greedy',
      headingInteractionEnabled: true,
      tiltInteractionEnabled: true,
      mapId: this.google.mapId,
    });
    this.routeMap.addListener('dragstart', () => {
      this.userInteracted = true;
    });
    this.routeMap.addListener('zoom_changed', () => {
      this.userInteracted = true;
    });
  }

  render(state: TrackingMapRenderState): void {
    if (!this.google || !state.provider) return;

    if (this.routeMap) {
      this.providerMarker = this.upsertProviderMarker(
        this.providerMarker,
        this.routeMap,
        state.provider,
        state,
      );
      if (state.destination) {
        this.destinationMarker = this.upsertDestinationMarker(
          this.destinationMarker,
          this.routeMap,
          state.destination,
        );
      }
      this.renderRoutes(state.routes);
      this.fitRoute(state.provider, state.destination);
    }
  }

  setSatellite(enabled: boolean): void {
    this.routeMap?.setMapTypeId(enabled ? 'satellite' : 'roadmap');
  }

  setHeading(headingDegrees: number): void {
    this.routeMap?.setOptions?.({
      headingInteractionEnabled: true,
      tiltInteractionEnabled: true,
    });
    const supportsNativeRotation =
      this.routeMap?.getRenderingType?.()?.toUpperCase() === 'VECTOR';
    this.routeMap?.moveCamera?.({
      heading: headingDegrees,
      tilt: headingDegrees === 0 ? 0 : 45,
    });
    this.routeMap?.setHeading?.(headingDegrees);
    this.routeMap?.setTilt?.(headingDegrees === 0 ? 0 : 45);
    this.applyCssRotationFallback(supportsNativeRotation ? 0 : headingDegrees);
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
    if (this.destinationMarker) {
      this.destinationMarker.map = null;
    }
    this.destinationMarker = undefined;
    this.routePolylines.forEach((polyline) => polyline.setMap(null));
    this.routePolylines = [];
    this.lastBoundsKey = '';
    this.userInteracted = false;
    this.lastProviderPosition = null;
  }

  destroyRouteMap(): void {
    this.cancelAnimation();
    this.applyCssRotationFallback(0);
    if (this.providerMarker) {
      this.providerMarker.map = null;
    }
    if (this.destinationMarker) {
      this.destinationMarker.map = null;
    }
    this.routePolylines.forEach((polyline) => polyline.setMap(null));
    this.clearListeners(this.routeMap);
    this.providerMarker = undefined;
    this.destinationMarker = undefined;
    this.routePolylines = [];
    this.routeMap = undefined;
    this.routeMapElement = undefined;
    this.lastBoundsKey = '';
    this.userInteracted = false;
  }

  destroy(): void {
    this.destroyRouteMap();
  }

  private renderRoutes(routes: TrackingMapRoute[]): void {
    if (!this.google || !this.routeMap) return;

    while (this.routePolylines.length > routes.length) {
      this.routePolylines.pop()?.setMap(null);
    }

    routes.forEach((route, index) => {
      const options = {
        map: this.routeMap,
        path: route.coordinates,
        strokeColor: route.selected
          ? '#1eb980'
          : index % 2 === 0
            ? '#f97316'
            : '#2f80ed',
        strokeOpacity: route.selected ? 0.96 : 0.72,
        strokeWeight: route.selected ? 7 : 5,
        zIndex: route.selected ? 20 : 10,
        clickable: !route.selected,
      };
      let polyline = this.routePolylines[index];
      if (!polyline) {
        polyline = new this.google!.maps.Polyline(options);
        polyline.addListener('click', () => this.routeSelected?.(route.id));
        this.routePolylines[index] = polyline;
      } else {
        polyline.setOptions(options);
        polyline.setPath(route.coordinates);
        polyline.setMap(this.routeMap as GoogleMapsMapInstance);
      }
    });
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
        ),
        zIndex: 30,
      });
    }

    marker.content = this.providerMarkerContent(
      state.statusLabel,
      state.remainingLabel,
      heading,
      position,
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
  ): void {
    if (!this.google || !this.routeMap || this.userInteracted) return;
    if (!destination) {
      this.routeMap.setCenter(provider);
      this.routeMap.setZoom(15);
      return;
    }

    const key = `${provider.lat.toFixed(5)},${provider.lng.toFixed(5)}|${destination.lat.toFixed(5)},${destination.lng.toFixed(5)}`;
    if (key === this.lastBoundsKey) return;
    this.lastBoundsKey = key;
    const bounds = new this.google.maps.LatLngBounds();
    bounds.extend(provider);
    bounds.extend(destination);
    this.routeMap.fitBounds(bounds, 84);
  }

  private providerMarkerContent(
    statusLabel: string,
    remainingLabel: string,
    headingDegrees: number,
    position: GoogleMapsPoint,
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
      'max-width:240px;padding:7px 11px;border:1px solid rgba(15,23,42,.12);border-radius:10px;background:#fff;color:#111827;box-shadow:0 10px 24px rgba(15,23,42,.2);font:800 11px/1.25 Arial,sans-serif;text-align:center;white-space:normal;';

    const pointer = document.createElement('span');
    pointer.style.cssText =
      'width:8px;height:8px;margin-top:-7px;background:#fff;border-right:1px solid rgba(15,23,42,.12);border-bottom:1px solid rgba(15,23,42,.12);transform:rotate(45deg);';

    const taxi = document.createElement('div');
    taxi.style.cssText = `width:76px;height:49px;transform:rotate(${headingDegrees - 90}deg);transform-origin:50% 72%;transition:transform 500ms ease;filter:drop-shadow(0 8px 8px rgba(15,23,42,.28));`;
    taxi.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="76" height="49" viewBox="0 0 76 49" aria-hidden="true">
        <circle cx="38" cy="31" r="18" fill="#facc15" fill-opacity=".18"/>
        <g>
          <rect x="30" y="5" width="17" height="7" rx="2" fill="#111827"/>
          <text x="38.5" y="10.5" fill="#fff" font-family="Arial,sans-serif" font-size="5" font-weight="700" text-anchor="middle">TAXI</text>
          <path d="M12 26h5l7-12h25l11 12h4c4 0 7 3 7 7v5H6v-5c0-4 2-7 6-7z" fill="#facc15" stroke="#fff" stroke-width="2"/>
          <path d="M27 16h9v10H20zM39 16h9l9 10H39z" fill="#dbeafe" stroke="#111827" stroke-width="1.4"/>
          <path d="M8 30h62" stroke="#111827" stroke-width="3"/>
          <path d="M30 27h4v4h-4zM34 31h4v4h-4zM38 27h4v4h-4zM42 31h4v4h-4z" fill="#111827"/>
          <circle cx="19" cy="38" r="6" fill="#111827" stroke="#fff" stroke-width="2"/>
          <circle cx="58" cy="38" r="6" fill="#111827" stroke="#fff" stroke-width="2"/>
          <circle cx="19" cy="38" r="2" fill="#94a3b8"/><circle cx="58" cy="38" r="2" fill="#94a3b8"/>
        </g>
      </svg>`;

    const badge = document.createElement('span');
    badge.textContent = remainingLabel;
    badge.style.cssText =
      'margin-top:-8px;padding:3px 7px;border-radius:999px;background:#111827;color:#fff;font:800 9px/1 Arial,sans-serif;box-shadow:0 4px 10px rgba(15,23,42,.25);';

    content.append(bubble, pointer, taxi, badge);
    return content;
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

  private normalizeHeading(value: number): number {
    return ((value % 360) + 360) % 360;
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
