import { CommonModule } from '@angular/common';
import {
  AfterViewInit,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  NgZone,
  OnChanges,
  OnDestroy,
  Output,
  SimpleChanges,
  ViewChild,
  inject,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';

type MapStyle = 'roadmap' | 'satellite';

type LeafletRuntime = {
  map: (element: HTMLElement, options: Record<string, unknown>) => LeafletMap;
  tileLayer: (url: string, options?: Record<string, unknown>) => LeafletLayer;
  marker: (coords: [number, number], options?: Record<string, unknown>) => LeafletMarker;
  divIcon: (options: Record<string, unknown>) => unknown;
  control: {
    zoom: (options: Record<string, unknown>) => { addTo: (map: LeafletMap) => void };
  };
};

type LeafletMap = {
  setView: (coords: [number, number], zoom: number) => void;
  on: (event: string, handler: (event: { latlng: { lat: number; lng: number } }) => void) => void;
  remove: () => void;
  removeLayer: (layer: LeafletLayer) => void;
  invalidateSize: () => void;
};

type LeafletLayer = {
  addTo: (map: LeafletMap) => LeafletLayer;
};

type LeafletMarker = {
  addTo: (map: LeafletMap) => LeafletMarker;
  setLatLng: (coords: [number, number]) => void;
};

declare global {
  interface Window {
    L?: LeafletRuntime;
  }
}

let leafletPromise: Promise<LeafletRuntime> | null = null;

function loadLeaflet(): Promise<LeafletRuntime> {
  if (typeof window === 'undefined') {
    return Promise.reject(new Error('Leaflet requires a browser runtime.'));
  }

  if (window.L) {
    return Promise.resolve(window.L);
  }

  leafletPromise ??= new Promise((resolve, reject) => {
    const existingLink = document.querySelector('link[data-jokko-leaflet]');
    if (!existingLink) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      link.crossOrigin = '';
      link.setAttribute('data-jokko-leaflet', 'true');
      document.head.appendChild(link);
    }

    const existingScript = document.querySelector('script[data-jokko-leaflet]');
    if (existingScript) {
      existingScript.addEventListener('load', () => resolve(window.L as LeafletRuntime));
      existingScript.addEventListener('error', () => reject(new Error('Leaflet failed to load.')));
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.crossOrigin = '';
    script.setAttribute('data-jokko-leaflet', 'true');
    script.onload = () => resolve(window.L as LeafletRuntime);
    script.onerror = () => reject(new Error('Leaflet failed to load.'));
    document.head.appendChild(script);
  });

  return leafletPromise;
}

@Component({
  selector: 'app-service-proposal-interactive-map',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideAngularModule],
  templateUrl: './service-proposal-interactive-map.component.html',
  styleUrl: './service-proposal-interactive-map.component.scss',
})
export class ServiceProposalInteractiveMapComponent implements AfterViewInit, OnChanges, OnDestroy {
  @ViewChild('mapContainer') private readonly mapContainer?: ElementRef<HTMLDivElement>;
  @ViewChild('searchInput') private readonly searchInput?: ElementRef<HTMLInputElement>;

  @Input() address = '';
  @Input() expanded = false;
  @Output() readonly addressSelected = new EventEmitter<string>();
  @Output() readonly expandedChange = new EventEmitter<boolean>();

  protected searchQuery = '';
  protected loading = true;
  protected isSearching = false;
  protected geocodingStatus = '';
  protected mapStyle: MapStyle = 'roadmap';

  private readonly zone = inject(NgZone);
  private readonly dakarCoords: [number, number] = [14.7167, -17.4677];
  private readonly tileLayers: Record<MapStyle, string> = {
    roadmap: 'https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}',
    satellite: 'https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}',
  };
  private leaflet: LeafletRuntime | null = null;
  private map: LeafletMap | null = null;
  private tileLayer: LeafletLayer | null = null;
  private marker: LeafletMarker | null = null;
  private searchTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private resizeTimeoutId: ReturnType<typeof setTimeout> | null = null;

  ngAfterViewInit(): void {
    this.searchQuery = this.address;
    this.loadMap();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['address'] && changes['address'].currentValue !== this.searchQuery) {
      this.searchQuery = changes['address'].currentValue || '';
    }

    if (changes['expanded'] && this.map) {
      this.resizeTimeoutId = setTimeout(() => this.map?.invalidateSize(), 310);
    }
  }

  ngOnDestroy(): void {
    if (this.searchTimeoutId) {
      clearTimeout(this.searchTimeoutId);
    }
    if (this.resizeTimeoutId) {
      clearTimeout(this.resizeTimeoutId);
    }
    this.map?.remove();
    this.map = null;
  }

  getSearchInputElement(): HTMLInputElement | null {
    return this.searchInput?.nativeElement ?? null;
  }

  protected updateSearch(value: string): void {
    this.searchQuery = value;
    this.addressSelected.emit(value);
    this.geocodingStatus = value.trim() ? this.statusLabel(value) : '';
  }

  protected submitSearch(): void {
    this.applyAddress(this.searchQuery.trim());
  }

  protected setMapStyle(style: MapStyle): void {
    if (this.mapStyle === style) {
      return;
    }
    this.mapStyle = style;
    this.refreshTileLayer();
  }

  protected toggleExpanded(): void {
    this.expandedChange.emit(!this.expanded);
  }

  private loadMap(): void {
    loadLeaflet()
      .then((leaflet) => {
        this.zone.runOutsideAngular(() => {
          this.leaflet = leaflet;
          this.initializeMap();
        });
      })
      .catch(() => {
        this.zone.run(() => {
          this.loading = false;
          this.geocodingStatus = 'Carte indisponible, saisissez votre adresse.';
        });
      });
  }

  private initializeMap(): void {
    const container = this.mapContainer?.nativeElement;
    if (!this.leaflet || !container || this.map) {
      return;
    }

    const map = this.leaflet.map(container, {
      center: this.dakarCoords,
      zoom: 13,
      zoomControl: false,
      attributionControl: false,
    });
    this.leaflet.control.zoom({ position: 'bottomright' }).addTo(map);
    this.map = map;
    this.refreshTileLayer();
    map.on('click', (event) => {
      this.selectCoordinates(event.latlng.lat, event.latlng.lng);
    });

    this.zone.run(() => {
      this.loading = false;
      this.geocodingStatus = this.address ? this.statusLabel(this.address) : '';
    });

    this.geocodingStatus = this.address ? this.statusLabel(this.address) : '';
  }

  private refreshTileLayer(): void {
    if (!this.leaflet || !this.map) {
      return;
    }
    if (this.tileLayer) {
      this.map.removeLayer(this.tileLayer);
    }
    this.tileLayer = this.leaflet
      .tileLayer(this.tileLayers[this.mapStyle], {
        maxZoom: 20,
        subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
      })
      .addTo(this.map);
  }

  private placeMarker(lat: number, lng: number): void {
    if (!this.leaflet || !this.map) {
      return;
    }
    if (this.marker) {
      this.marker.setLatLng([lat, lng]);
      return;
    }

    const icon = this.leaflet.divIcon({
      html: '<div class="jokko-map-marker"><span></span><i></i></div>',
      className: 'jokko-map-marker-shell',
      iconSize: [40, 40],
      iconAnchor: [20, 30],
    });
    this.marker = this.leaflet.marker([lat, lng], { icon }).addTo(this.map);
  }

  private selectCoordinates(lat: number, lng: number): void {
    this.placeMarker(lat, lng);
    const coordinates = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    this.applyAddress(coordinates);
    this.geocodingStatus = 'Coordonnees GPS selectionnees';
  }

  private applyAddress(value: string): void {
    this.searchQuery = value;
    this.addressSelected.emit(value);
  }

  private statusLabel(value: string): string {
    return value ? `Adresse selectionnee: ${value.split(',')[0]}` : '';
  }
}
