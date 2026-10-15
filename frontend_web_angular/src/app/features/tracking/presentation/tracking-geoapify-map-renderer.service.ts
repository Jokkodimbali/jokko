import { geoapifyTileUrl, GEOAPIFY_ATTRIBUTION } from '../../../shared/maps/geoapify-tiles';
import { Injectable, inject } from '@angular/core';
import type * as Leaflet from 'leaflet';
import { loadLeaflet } from '../../../shared/maps/leaflet-loader';
import { MapProviderService } from '../../../shared/maps/map-provider.service';
import type { MapPoint } from '../../../shared/maps/map.models';
import type { NavigationCameraMode, TrackingMapRenderState } from './tracking-map.models';
import type { TrackingMapRendererPort } from './tracking-map-renderer.port';
import { MERCHANT_MAP_IMAGES } from '../../../shared/maps/merchant-map-assets';
import { createNavigationArrowIcon } from './navigation-arrow-icon';
import { interpolateTrackingPosition } from './tracking-route-interpolation';

@Injectable()
export class TrackingGeoapifyMapRendererService implements TrackingMapRendererPort {
  readonly supportsSatellite = false;
  private readonly provider = inject(MapProviderService);
  private leaflet: typeof Leaflet | null = null;
  private map: Leaflet.Map | null = null;
  private mapElement: HTMLElement | null = null;
  private initialization: Promise<void> | null = null;
  private generation = 0;
  private routes: Leaflet.Polyline[] = [];
  private maneuverMarkers: Leaflet.CircleMarker[] = [];
  private routeRenderKey = '';
  private traveler: Leaflet.Marker | null = null;
  private travelerRenderKey = '';
  private destination: Leaflet.Marker | null = null;
  private destinationRenderKey = '';
  private mode: NavigationCameraMode = 'FOLLOWING';
  private topView = false;
  private lastState: TrackingMapRenderState | null = null;
  private onRouteSelected: ((id: string) => void) | null = null;
  private headingDegrees = 0;
  private cameraUpdateInProgress = false;
  private lastOverviewKey = '';
  private lastMapSize = '';
  private travelerFrame: number | null = null;
  private travelerTarget: MapPoint | null = null;
  private lastTravelerSourceAt: number | null = null;
  private lastCameraFrameAt = 0;
  private travelerMotionGeneration = 0;

  async initializeRouteMap(element: HTMLElement, _satellite: boolean, onRouteSelected: (id: string) => void, initialCenter?: MapPoint): Promise<void> {
    if (this.map && this.mapElement === element) return;
    if (this.initialization && this.mapElement === element) return this.initialization;
    this.destroyRouteMap();
    this.mapElement = element;
    const generation = this.generation;
    const initialization = this.createRouteMap(element, onRouteSelected, initialCenter, generation);
    this.initialization = initialization;
    try { await initialization; }
    finally { if (this.initialization === initialization) this.initialization = null; }
  }

  private async createRouteMap(element: HTMLElement, onRouteSelected: (id: string) => void, initialCenter: MapPoint | undefined, generation: number): Promise<void> {
    const [config, leaflet] = await Promise.all([this.provider.config(), loadLeaflet()]);
    if (generation !== this.generation) return;
    if (!config.geoapifyBrowserApiKey) throw new Error('Cle navigateur Geoapify manquante.');
    this.leaflet = leaflet;
    this.onRouteSelected = onRouteSelected;
    const center = initialCenter ?? { lat: 14.7167, lng: -17.4677 };
    this.map = this.leaflet.map(element).setView([center.lat, center.lng], 15);
    this.leaflet.tileLayer(geoapifyTileUrl(config.geoapifyBrowserApiKey), {
      maxZoom: 19,
      attribution: GEOAPIFY_ATTRIBUTION,
    }).addTo(this.map);
    this.mode = this.topView ? 'OVERVIEW' : 'FOLLOWING';
    this.lastOverviewKey = '';
    this.lastMapSize = '';
    this.map.on('dragstart zoomstart', () => {
      if (!this.cameraUpdateInProgress) this.mode = 'FREE';
    });
    setTimeout(() => this.map?.invalidateSize(), 0);
  }

  render(state: TrackingMapRenderState): void {
    this.lastState = state;
    const map = this.map;
    const leaflet = this.leaflet;
    if (!map || !leaflet) return;
    const mapSize = map.getSize();
    const sizeKey = `${mapSize.x}x${mapSize.y}`;
    if (sizeKey !== this.lastMapSize) {
      this.lastMapSize = sizeKey;
      map.invalidateSize({ pan: false });
      this.lastOverviewKey = '';
    }
    const routeKey = `${state.showManeuverMarkers === true}|${state.routes.map((route) => `${route.id}:${route.selected}:${route.coordinates.map((point) => `${point.lat.toFixed(5)},${point.lng.toFixed(5)}`).join(';')}:${route.navigationSteps?.map((step) => `${step.start?.lat},${step.start?.lng}:${step.instruction}`).join(';') ?? ''}`).join('|')}`;
    if (routeKey !== this.routeRenderKey) {
      this.resetRoute();
      this.routeRenderKey = routeKey;
      this.routes = state.routes.map((route) => {
        const line = leaflet.polyline(route.coordinates.map((point) => [point.lat, point.lng]), {
          color: route.selected ? '#8b572c' : '#86a3bf',
          weight: route.selected ? 7 : 4,
          opacity: route.selected ? 0.95 : 0.7,
        }).addTo(map);
        line.on('click', () => this.onRouteSelected?.(route.id));
        return line;
      });
      if (state.showManeuverMarkers) {
        const selected = state.routes.find((route) => route.selected);
        this.maneuverMarkers = (selected?.navigationSteps ?? [])
          .filter((step) => !!step.start)
          .slice(0, 12)
          .map((step) => leaflet.circleMarker([step.start!.lat, step.start!.lng], {
            radius: 5, color: '#fff', weight: 2, fillColor: '#8b572c', fillOpacity: 1,
          }).bindTooltip(step.instruction).addTo(map));
      }
    }
    if (state.provider) {
      const position: Leaflet.LatLngExpression = [state.provider.lat, state.provider.lng];
      const marker = state.travelerMarker;
      const markerKey = `${marker.kind}|${marker.imageUrl}|${marker.initials}|${marker.name}|${marker.roleLabel}|${marker.badgeAccent}|${state.routeCalculating === true}`;
      if (this.traveler) {
        this.moveTraveler(state);
        if (markerKey !== this.travelerRenderKey) this.traveler.setIcon(this.travelerIcon(leaflet, state));
      } else this.traveler = leaflet.marker(position, { icon: this.travelerIcon(leaflet, state), zIndexOffset: 1000 }).addTo(map);
      if (Number.isFinite(state.positionTimestampMs)) this.lastTravelerSourceAt = state.positionTimestampMs!;
      this.travelerRenderKey = markerKey;
      if (marker.kind === 'navigation') this.setHeading(this.navigationHeading(state));
    } else this.resetTravelerMarker();
    if (state.destination) {
      const position: Leaflet.LatLngExpression = [state.destination.lat, state.destination.lng];
      const marker = state.destinationMarker;
      const person = marker.person;
      const markerKey = `${marker.title}|${marker.subtitle}|${marker.etaLabel}|${marker.accent}|${person?.imageUrl}|${person?.initials}|${person?.label}|${person?.icon}`;
      if (this.destination) {
        this.destination.setLatLng(position);
        if (markerKey !== this.destinationRenderKey) this.destination.setIcon(this.destinationIcon(leaflet, state));
      } else this.destination = leaflet.marker(position, { icon: this.destinationIcon(leaflet, state), zIndexOffset: 500 }).addTo(map);
      this.destinationRenderKey = markerKey;
    } else {
      this.destination?.remove();
      this.destination = null;
      this.destinationRenderKey = '';
    }
    this.updateCamera(state);
  }

  setSatellite(_enabled: boolean): void { /* Geoapify raster styles do not provide Google's satellite layer. */ }
  setTopView(enabled: boolean): void {
    if (this.topView === enabled) return;
    this.topView = enabled;
    this.mode = enabled ? 'OVERVIEW' : 'RECENTERING';
    this.lastOverviewKey = '';
    if (enabled) {
      if (this.lastState) this.fitToRoute(this.lastState);
    } else {
      this.recenterNavigationCamera();
    }
  }
  setHeading(degrees: number): void {
    if (!Number.isFinite(degrees)) return;
    this.headingDegrees = ((degrees % 360) + 360) % 360;
    const arrow = this.traveler?.getElement()?.querySelector<HTMLElement>('.jokko-tracking-navigation-arrow');
    if (arrow) arrow.style.transform = `rotate(${this.headingDegrees}deg)`;
  }

  private navigationHeading(state: TrackingMapRenderState): number {
    const route = state.routes.find((candidate) => candidate.selected);
    const position = state.provider;
    if (route && position && route.coordinates.length > 1) {
      let closestDistance = Number.POSITIVE_INFINITY;
      let heading: number | null = null;
      const longitudeScale = Math.cos(position.lat * Math.PI / 180);
      for (let index = 1; index < route.coordinates.length; index += 1) {
        const start = route.coordinates[index - 1];
        const end = route.coordinates[index];
        const east = (end.lng - start.lng) * longitudeScale;
        const north = end.lat - start.lat;
        const segmentLengthSquared = east * east + north * north;
        if (segmentLengthSquared === 0) continue;
        const toPositionEast = (position.lng - start.lng) * longitudeScale;
        const toPositionNorth = position.lat - start.lat;
        const progress = Math.max(0, Math.min(1,
          (toPositionEast * east + toPositionNorth * north) / segmentLengthSquared,
        ));
        const distance = Math.hypot(
          toPositionEast - progress * east,
          toPositionNorth - progress * north,
        );
        if (distance < closestDistance) {
          closestDistance = distance;
          heading = Math.atan2(east, north) * 180 / Math.PI;
        }
      }
      if (heading !== null && closestDistance < 0.001) return heading;
    }
    return state.headingDegrees ?? this.headingDegrees;
  }
  recenterNavigationCamera(): void {
    const state = this.lastState;
    this.mode = 'FOLLOWING';
    if (state) this.followTraveler(state, true);
  }
  getCameraMode(): NavigationCameraMode { return this.mode; }
  resetTravelerMarker(): void {
    this.cancelTravelerMotion();
    this.traveler?.remove();
    this.traveler = null;
    this.travelerRenderKey = '';
    this.lastTravelerSourceAt = null;
  }
  resetRoute(): void {
    for (const route of this.routes) route.remove();
    this.routes = [];
    for (const marker of this.maneuverMarkers) marker.remove();
    this.maneuverMarkers = [];
    this.routeRenderKey = '';
  }
  destroyRouteMap(): void {
    this.generation += 1;
    this.resetRoute();
    this.resetTravelerMarker();
    this.destination?.remove();
    this.destination = null;
    this.map?.remove();
    this.map = null;
    this.mapElement = null;
    this.initialization = null;
    this.lastOverviewKey = '';
    this.lastMapSize = '';
  }
  destroy(): void { this.destroyRouteMap(); }

  private updateCamera(state: TrackingMapRenderState): void {
    if (this.mode === 'FREE') return;
    if (state.arrived && state.destination) {
      this.mode = 'ARRIVAL';
      this.fitToRoute(state);
      return;
    }
    if (this.topView) {
      this.mode = 'OVERVIEW';
      this.fitToRoute(state);
      return;
    }
    const rendered = this.traveler?.getLatLng();
    this.followTraveler(state, false, rendered ? { lat: rendered.lat, lng: rendered.lng } : undefined);
  }

  private moveTraveler(state: TrackingMapRenderState): void {
    const marker = this.traveler;
    const target = state.provider;
    const map = this.map;
    if (!marker || !target || !map) return;
    if (state.arrived) {
      this.cancelTravelerMotion();
      marker.setLatLng([target.lat, target.lng]);
      return;
    }
    if (this.travelerTarget && map.distance(this.travelerTarget, target) < 0.5) return;
    const currentLatLng = marker.getLatLng();
    const from = { lat: currentLatLng.lat, lng: currentLatLng.lng };
    const distance = map.distance(from, target);
    const sourceAt = state.positionTimestampMs;
    const sourceInterval = sourceAt != null && this.lastTravelerSourceAt != null
      ? sourceAt - this.lastTravelerSourceAt : null;
    this.cancelTravelerMotion();
    if (
      distance < 1 || distance > 250 ||
      sourceInterval === null || sourceInterval < 150 || sourceInterval > 4_000 ||
      typeof requestAnimationFrame === 'undefined'
    ) {
      marker.setLatLng([target.lat, target.lng]);
      return;
    }

    this.travelerTarget = target;
    const generation = this.travelerMotionGeneration;
    const startedAt = performance.now();
    const durationMs = Math.min(650, Math.max(250, sourceInterval * 0.65));
    const selectedRoute = state.routeMatchMode === 'REROUTING' ||
      state.routeMatchMode === 'JOINING_ROUTE'
      ? null
      : state.routes.find((route) => route.selected)?.coordinates ?? null;
    const frame = (now: number): void => {
      if (generation !== this.travelerMotionGeneration || !this.map || !this.traveler) return;
      const fraction = Math.max(0, Math.min(1, (now - startedAt) / durationMs));
      const position = interpolateTrackingPosition(from, target, fraction, selectedRoute);
      marker.setLatLng([position.lat, position.lng]);
      if (!this.topView && this.mode === 'FOLLOWING' &&
          (fraction === 1 || now - this.lastCameraFrameAt >= 120)) {
        this.lastCameraFrameAt = now;
        this.followTraveler(this.lastState ?? state, false, position, false);
      }
      if (fraction < 1) this.travelerFrame = requestAnimationFrame(frame);
      else {
        this.travelerFrame = null;
        this.travelerTarget = null;
      }
    };
    this.travelerFrame = requestAnimationFrame(frame);
  }

  private cancelTravelerMotion(): void {
    this.travelerMotionGeneration += 1;
    if (this.travelerFrame !== null && typeof cancelAnimationFrame !== 'undefined') {
      cancelAnimationFrame(this.travelerFrame);
    }
    this.travelerFrame = null;
    this.travelerTarget = null;
  }

  private followTraveler(state: TrackingMapRenderState, force = false, visiblePosition?: MapPoint, animate = true): void {
    const position = visiblePosition ?? state.provider;
    const map = this.map;
    if (!position || !map || this.mode === 'FREE') return;
    const hasHeading = state.headingDegrees !== null ||
      state.routes.some((route) => route.selected && route.coordinates.length > 1);
    const heading = this.navigationHeading(state) * Math.PI / 180;
    const lookAheadMeters = hasHeading ? 75 : 0;
    const latitude = position.lat + Math.cos(heading) * lookAheadMeters / 111_320;
    const longitude = position.lng + Math.sin(heading) * lookAheadMeters /
      (111_320 * Math.max(0.1, Math.cos(position.lat * Math.PI / 180)));
    const focus: Leaflet.LatLngExpression = [latitude, longitude];
    const zoom = (state.speedKmh ?? 0) >= 45 ? 16 : 17;
    if (!force && map.distance(map.getCenter(), focus) < 8 && map.getZoom() === zoom) return;
    this.cameraUpdateInProgress = true;
    try {
      map.setView(focus, zoom, { animate: !force && animate, duration: 0.4 });
    } finally {
      this.cameraUpdateInProgress = false;
    }
    this.mode = 'FOLLOWING';
  }

  private fitToRoute(state: TrackingMapRenderState): void {
    const selected = state.routes.find((route) => route.selected);
    if (!this.map || !this.leaflet) return;
    const points = selected?.coordinates.length && selected.coordinates.length >= 2
      ? [...selected.coordinates]
      : [];
    if (state.provider) points.push(state.provider);
    if (state.destination) points.push(state.destination);
    const hasDistinctPoints = points.length > 1 && points.some((point) =>
      this.map!.distance([point.lat, point.lng], [points[0].lat, points[0].lng]) > 1,
    );
    if (!hasDistinctPoints) {
      if (state.arrived && state.destination) {
        const center: Leaflet.LatLngExpression = [state.destination.lat, state.destination.lng];
        if (this.map.distance(this.map.getCenter(), center) > 8) {
          this.cameraUpdateInProgress = true;
          try { this.map.setView(center, Math.max(this.map.getZoom(), 16), { animate: false }); }
          finally { this.cameraUpdateInProgress = false; }
        }
      }
      return;
    }
    const bounds = this.leaflet.latLngBounds(points.map((point) => [point.lat, point.lng]));
    const size = this.map.getSize();
    const routePoints = selected?.coordinates ?? [];
    const routeMiddle = routePoints[Math.floor(routePoints.length / 2)];
    const routeEnd = routePoints.at(-1);
    const key = [
      state.arrived ? 'arrival' : 'route',
      selected?.id ?? 'points',
      routePoints.length,
      routePoints[0]?.lat.toFixed(5), routePoints[0]?.lng.toFixed(5),
      routeMiddle?.lat.toFixed(5), routeMiddle?.lng.toFixed(5),
      routeEnd?.lat.toFixed(5), routeEnd?.lng.toFixed(5),
      state.destination?.lat.toFixed(5), state.destination?.lng.toFixed(5),
      `${size.x}x${size.y}`,
    ].join('|');
    if (key === this.lastOverviewKey &&
        ((size.x === 0 || size.y === 0) || this.map.getBounds().contains(bounds))) return;
    this.lastOverviewKey = key;
    this.cameraUpdateInProgress = true;
    try {
      this.map.fitBounds(bounds, {
        padding: [
          Math.min(100, Math.round(size.x * 0.22)),
          Math.min(120, Math.round(size.y * 0.24)),
        ],
        animate: false,
      });
    } finally {
      this.cameraUpdateInProgress = false;
    }
  }

  private travelerIcon(leaflet: typeof Leaflet, state: TrackingMapRenderState): Leaflet.DivIcon {
    const navigation = state.travelerMarker.kind === 'navigation';
    return leaflet.divIcon({
      className: 'jokko-tracking-leaflet-marker',
      html: this.travelerContent(state),
      iconSize: navigation ? [54, 54] : [120, 90],
      iconAnchor: navigation ? [27, 27] : [60, 26],
    });
  }

  private destinationIcon(leaflet: typeof Leaflet, state: TrackingMapRenderState): Leaflet.DivIcon {
    return leaflet.divIcon({ className: 'jokko-tracking-leaflet-marker', html: this.destinationContent(state), iconSize: [188, 120], iconAnchor: [94, 112] });
  }

  private travelerContent(state: TrackingMapRenderState): HTMLElement {
    const marker = state.travelerMarker;
    const root = document.createElement('div');
    root.style.cssText = marker.kind === 'navigation'
      ? 'display:flex;align-items:center;justify-content:center;width:54px;height:54px;pointer-events:none;'
      : 'display:flex;flex-direction:column;align-items:center;width:120px;pointer-events:none;';
    if (marker.kind === 'navigation') {
      const shell = document.createElement('span');
      shell.className = state.routeCalculating
        ? 'jokko-tracking-navigation-dot'
        : 'jokko-tracking-navigation-arrow';
      shell.setAttribute('aria-label', marker.name || 'Navigation');
      shell.style.cssText = state.routeCalculating
        ? 'display:flex;align-items:center;justify-content:center;width:42px;height:42px;border-radius:50%;background:rgba(134,82,33,.22);'
        : 'display:flex;align-items:center;justify-content:center;width:42px;height:42px;border:1px solid rgba(15,23,42,.1);border-radius:50%;background:#fff;box-shadow:0 9px 18px rgba(15,23,42,.22);box-sizing:border-box;transition:transform 500ms ease;';
      if (state.routeCalculating) {
        const dot = document.createElement('span');
        dot.style.cssText = 'display:block;width:28px;height:28px;border:3px solid #fff;border-radius:50%;background:#865221;box-shadow:0 2px 5px rgba(15,23,42,.35);box-sizing:border-box;';
        shell.appendChild(dot);
      } else {
        shell.appendChild(createNavigationArrowIcon(29));
      }
      root.appendChild(shell);
      return root;
    }
    const circle = document.createElement('span');
    const vehicle = marker.kind === 'vehicle';
    circle.style.cssText = vehicle
      ? 'display:flex;align-items:center;justify-content:center;width:90px;height:64px;'
      : 'display:flex;align-items:center;justify-content:center;width:48px;height:48px;border:3px solid #2f80ff;border-radius:50%;background:#eff6ff;overflow:hidden;box-shadow:0 8px 18px #0f172a44;';
    if (marker.imageUrl) {
      const image = document.createElement('img');
      image.src = marker.imageUrl;
      image.alt = marker.name;
      image.referrerPolicy = 'no-referrer';
      image.style.cssText = vehicle ? 'width:100%;height:100%;object-fit:contain;' : 'width:100%;height:100%;object-fit:cover;';
      image.onerror = () => { image.replaceWith(this.initials(marker.initials)); };
      circle.appendChild(image);
    } else circle.appendChild(this.initials(marker.initials));
    root.appendChild(circle);
    if (marker.kind === 'avatar' && marker.roleLabel) {
      const badge = document.createElement('span');
      badge.textContent = marker.roleLabel;
      badge.style.cssText = `background:${marker.badgeAccent === 'red' ? '#ff3b30' : '#2f80ff'};color:white;border:2px solid white;border-radius:9px;padding:5px 8px;font:800 12px/1 sans-serif;max-width:116px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;`;
      root.appendChild(badge);
    }
    return root;
  }

  private destinationContent(state: TrackingMapRenderState): HTMLElement {
    const marker = state.destinationMarker;
    const color = marker.accent === 'red' ? '#ff3b30' : '#2f80ff';
    const root = document.createElement('div');
    root.style.cssText = 'display:flex;flex-direction:column;align-items:center;width:188px;pointer-events:none;';
    const card = document.createElement('div');
    card.style.cssText = 'display:flex;align-items:center;gap:7px;width:100%;box-sizing:border-box;background:white;border:1px solid #e2e8f0;border-radius:14px;padding:7px;box-shadow:0 8px 20px #0f172a33;';
    const eta = document.createElement('strong');
    eta.textContent = marker.etaLabel;
    eta.style.cssText = `background:${color};color:white;border-radius:9px;padding:7px;font:800 12px/1.1 sans-serif;white-space:nowrap;`;
    const body = document.createElement('span');
    body.style.cssText = 'display:flex;flex-direction:column;min-width:0;';
    const title = document.createElement('strong');
    title.textContent = marker.title;
    title.style.cssText = 'font:800 12px/1.2 sans-serif;color:#111827;overflow-wrap:anywhere;';
    const subtitle = document.createElement('small');
    subtitle.textContent = marker.subtitle;
    subtitle.style.cssText = 'font:700 10px/1.2 sans-serif;color:#64748b;';
    body.append(title, subtitle);
    card.append(eta, body);
    root.appendChild(card);
    if (marker.person) {
      const person = marker.person;
      const avatar = document.createElement('span');
      const personColor = person.icon === 'pharmacy' ? '#20a05a' : person.icon === 'hardware' ? '#995d20' : person.badgeAccent === 'red' ? '#ff3b30' : '#2f80ff';
      avatar.style.cssText = `display:flex;align-items:center;justify-content:center;width:46px;height:46px;margin-top:-2px;border:3px solid ${personColor};border-radius:50%;background:#eff6ff;overflow:hidden;box-shadow:0 5px 12px #0f172a33;`;
      const imageUrl = person.icon === 'pharmacy' ? MERCHANT_MAP_IMAGES.PHARMACY : person.icon === 'hardware' ? MERCHANT_MAP_IMAGES.MATERIAL : person.imageUrl;
      if (imageUrl) {
        const image = document.createElement('img');
        image.src = imageUrl;
        image.alt = person.name;
        image.referrerPolicy = 'no-referrer';
        image.style.cssText = 'width:100%;height:100%;object-fit:cover;';
        image.onerror = () => { image.replaceWith(this.initials(person.initials)); };
        avatar.appendChild(image);
      } else avatar.appendChild(this.initials(person.initials));
      const label = document.createElement('span');
      label.textContent = person.label;
      label.style.cssText = `background:${personColor};color:white;border:2px solid white;border-radius:8px;padding:4px 7px;font:800 11px/1 sans-serif;`;
      root.append(avatar, label);
    }
    return root;
  }

  private initials(value: string): HTMLElement {
    const span = document.createElement('span');
    span.textContent = value || 'JK';
    span.style.cssText = 'font:900 14px/1 sans-serif;color:#0f172a;';
    return span;
  }
}
