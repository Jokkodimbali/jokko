import { geoapifyTileUrl, GEOAPIFY_ATTRIBUTION } from './geoapify-tiles';
import { MerchantMapKind, applyMerchantAvatarStyle } from './merchant-map-assets';
import {
  AfterViewInit,
  Component,
  ElementRef,
  Input,
  OnChanges,
  OnDestroy,
  ViewChild,
  inject,
  signal,
} from '@angular/core';
import { userInitials } from '../utils/user-initials';
import type * as Leaflet from 'leaflet';
import { MapProviderService } from './map-provider.service';
import { loadLeaflet } from './leaflet-loader';
import {
  GoogleMapsAdvancedMarkerInstance,
  GoogleMapsLoaderService,
  GoogleMapsMapInstance,
  GoogleMapsRuntime,
} from './google-maps-loader.service';

/** Read-only preview using the application's shared Maps runtime and configuration. */
@Component({
  selector: 'app-location-map',
  standalone: true,
  template: `<div
      #canvas
      class="map"
      role="img"
      [attr.aria-label]="'Localisation de ' + label"
    ></div>
    <div hidden>
      <div #markerContent class="merchant-marker" [attr.aria-label]="label">
        @if (avatarUrl && failedAvatar() !== avatarUrl) {
          <img
            [src]="avatarUrl"
            [alt]="label"
            referrerpolicy="no-referrer"
            (error)="failedAvatar.set(avatarUrl)"
          />
        } @else {
          <span>{{ initials(label) }}</span>
        }
      </div>
    </div>
    @if (unavailable()) {
      <p>{{ address || 'Localisation indisponible' }}</p>
    }`,
  styles: [
    `
      :host {
        display: block;
        height: 100%;
        position: relative;
      }
      .map {
        height: 100%;
        width: 100%;
      }
      .merchant-marker {
        width: 38px;
        height: 38px;
        display: grid;
        place-items: center;
        border: 2px solid currentColor;
        border-radius: 50%;
        background: white;
        color: #865221;
        box-shadow: 0 3px 10px #38200b66;
        font: 600 12px var(--font-app);
      }
      .merchant-marker img {
        width: 100%;
        height: 100%;
        border-radius: inherit;
        object-fit: cover;
      }
      p {
        position: absolute;
        inset: 0;
        display: grid;
        place-content: center;
        margin: 0;
        padding: 12px;
        text-align: center;
        font-size: 12px;
        background: #eef1ed;
        overflow-wrap: anywhere;
      }
    `,
  ],
})
export class LocationMapComponent implements AfterViewInit, OnChanges, OnDestroy {
  @Input() latitude: number | null = null;
  @Input() longitude: number | null = null;
  @Input() label = '';
  @Input() merchantKind: MerchantMapKind | null = null;
  @Input() avatarUrl: string | null = null;
  protected readonly failedAvatar = signal<string | null>(null);
  protected readonly initials = userInitials;
  @ViewChild('markerContent', { static: true }) private markerContent!: ElementRef<HTMLElement>;
  @Input() address = '';
  @ViewChild('canvas', { static: true }) private canvas!: ElementRef<HTMLElement>;
  protected readonly unavailable = signal(true);
  private readonly loader = inject(GoogleMapsLoaderService);
  private readonly provider = inject(MapProviderService);
  private leafletMap: Leaflet.Map | null = null;
  private leafletMarker: Leaflet.CircleMarker | null = null;
  private leafletRuntime: typeof Leaflet | null = null;
  private geoapifyKey = '';
  private providerLoaded = false;
  private useGeoapify = false;
  private runtime: GoogleMapsRuntime | null = null;
  private map: GoogleMapsMapInstance | null = null;
  private marker: GoogleMapsAdvancedMarkerInstance | null = null;
  private ready = false;
  private destroyed = false;
  private loading = false;

  ngAfterViewInit(): void {
    this.ready = true;
    void this.render();
  }
  ngOnChanges(): void {
    if (this.ready) void this.render();
  }
  ngOnDestroy(): void {
    this.destroyed = true;
    if (this.marker) this.marker.map = null;
    if (this.map) this.runtime?.maps.event?.clearInstanceListeners(this.map);
    this.map = null;
    this.leafletMap?.remove();
    this.leafletMap = null;
  }
  private async render(): Promise<void> {
    if (this.merchantKind)
      applyMerchantAvatarStyle(this.markerContent.nativeElement, this.merchantKind);
    if (
      this.latitude == null ||
      this.longitude == null ||
      !Number.isFinite(this.latitude) ||
      !Number.isFinite(this.longitude) ||
      Math.abs(this.latitude) > 90 ||
      Math.abs(this.longitude) > 180
    ) {
      this.unavailable.set(true);
      if (this.marker) this.marker.map = null;
      return;
    }
    if (!this.providerLoaded) {
      if (this.loading) return;
      this.loading = true;
      try {
        const config = await this.provider.config();
        this.useGeoapify = config.provider === 'geoapify';
        this.geoapifyKey = config.geoapifyBrowserApiKey;
        this.providerLoaded = true;
      } catch {
        this.unavailable.set(true);
        return;
      } finally {
        this.loading = false;
      }
      if (!this.destroyed) return this.render();
    }
    if (this.useGeoapify) {
      await this.renderGeoapify();
      return;
    }
    if (!this.runtime) {
      if (this.loading) return;
      this.loading = true;
      try {
        this.runtime = await this.loader.load();
      } catch {
        this.unavailable.set(true);
        return;
      } finally {
        this.loading = false;
      }
      if (this.destroyed) return;
      // Inputs may have changed while Maps was loading.
      return this.render();
    }
    const center = { lat: this.latitude, lng: this.longitude };
    if (!this.map) {
      this.map = new this.runtime.maps.Map(this.canvas.nativeElement, {
        center,
        zoom: 15,
        mapId: this.runtime.mapId,
        disableDefaultUI: true,
        gestureHandling: 'none',
        keyboardShortcuts: false,
        clickableIcons: false,
      });
    } else this.map.setCenter(center);
    if (this.runtime.maps.marker) {
      if (!this.marker)
        this.marker = new this.runtime.maps.marker.AdvancedMarkerElement({
          map: this.map,
          position: center,
          title: this.label,
          content: this.markerContent.nativeElement,
        });
      else {
        this.marker.position = center;
        this.marker.title = this.label;
        this.marker.map = this.map;
      }
    }
    this.unavailable.set(false);
  }

  private async renderGeoapify(): Promise<void> {
    if (!this.geoapifyKey || this.destroyed || this.latitude == null || this.longitude == null) {
      this.unavailable.set(true);
      return;
    }
    if (!this.leafletRuntime) this.leafletRuntime = await loadLeaflet();
    if (this.destroyed) return;
    const leaflet = this.leafletRuntime;
    const position: Leaflet.LatLngExpression = [this.latitude, this.longitude];
    if (!this.leafletMap) {
      this.leafletMap = leaflet.map(this.canvas.nativeElement, {
        zoomControl: false,
        dragging: false,
        scrollWheelZoom: false,
        doubleClickZoom: false,
        keyboard: false,
      }).setView(position, 15);
      leaflet.tileLayer(geoapifyTileUrl(this.geoapifyKey), {
        maxZoom: 19,
        attribution: GEOAPIFY_ATTRIBUTION,
      }).addTo(this.leafletMap);
    } else this.leafletMap.setView(position, 15);
    if (this.leafletMarker) this.leafletMarker.setLatLng(position);
    else this.leafletMarker = leaflet.circleMarker(position, {
      radius: 9,
      color: '#ffffff',
      weight: 3,
      fillColor: '#865221',
      fillOpacity: 1,
    }).addTo(this.leafletMap);
    this.unavailable.set(false);
    setTimeout(() => this.leafletMap?.invalidateSize(), 0);
  }
}
