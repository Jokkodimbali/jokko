import { CommonModule } from '@angular/common';
import {
  AfterViewInit,
  ChangeDetectorRef,
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
  signal,
} from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import {
  GoogleMapsAdvancedMarkerInstance,
  GoogleMapsAutocompleteSessionToken,
  GoogleMapsCoordinate,
  GoogleMapsLoaderService,
  GoogleMapsPlace,
  GoogleMapsPlacePrediction,
  GoogleMapsRuntime,
} from '../../../../../shared/maps/google-maps-loader.service';

type MapStyle = 'roadmap' | 'satellite';
type GoogleMapInstance = {
  setCenter: (coordinate: { lat: number; lng: number }) => void;
  setZoom: (zoom: number) => void;
  setMapTypeId: (type: MapStyle) => void;
  addListener: (
    eventName: string,
    handler: (event: { latLng?: { lat: () => number; lng: () => number } }) => void,
  ) => void;
};
type AddressSuggestion = {
  id: string;
  label: string;
  prediction: GoogleMapsPlacePrediction;
};

export type ServiceProposalMapAddressSelection = {
  address: string;
  coordinate: GoogleMapsCoordinate;
};

@Component({
  selector: 'app-service-proposal-interactive-map',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideAngularModule],
  templateUrl: './service-proposal-interactive-map.component.html',
  styleUrl: './service-proposal-interactive-map.component.scss',
})
export class ServiceProposalInteractiveMapComponent implements AfterViewInit, OnChanges, OnDestroy {
  @ViewChild('mapContainer') private readonly mapContainer?: ElementRef<HTMLDivElement>;

  @Input() address = '';
  @Input() expanded = false;
  @Output() readonly addressSelected = new EventEmitter<string>();
  @Output() readonly addressResolved = new EventEmitter<ServiceProposalMapAddressSelection>();
  @Output() readonly expandedChange = new EventEmitter<boolean>();

  protected searchQuery = '';
  protected loading = true;
  protected isSearching = false;
  protected geocodingStatus = '';
  protected mapStyle: MapStyle = 'roadmap';
  protected readonly addressSuggestions = signal<AddressSuggestion[]>([]);
  protected readonly isLoadingSuggestions = signal(false);

  private readonly zone = inject(NgZone);
  private readonly googleMaps = inject(GoogleMapsLoaderService);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly cdr = inject(ChangeDetectorRef);
  protected readonly fallbackMapUrl: SafeResourceUrl =
    this.sanitizer.bypassSecurityTrustResourceUrl(
      'https://www.openstreetmap.org/export/embed.html?bbox=-17.5677%2C14.6167%2C-17.3677%2C14.8167&layer=mapnik&marker=14.7167%2C-17.4677',
    );
  private readonly dakarCoords: GoogleMapsCoordinate = {
    latitude: 14.7167,
    longitude: -17.4677,
  };
  protected hasGoogleMap = true;
  private map: GoogleMapInstance | null = null;
  private marker: GoogleMapsAdvancedMarkerInstance | null = null;
  private autocompleteSessionToken: GoogleMapsAutocompleteSessionToken | null = null;
  private google: GoogleMapsRuntime | null = null;
  private resizeTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private autocompleteTimeoutId: ReturnType<typeof setTimeout> | null = null;
  private autocompleteRequestId = 0;
  private reverseGeocodeRequestId = 0;
  private mapLoadStarted = false;
  private resizeObserver: ResizeObserver | null = null;
  private refreshAnimationFrameId: number | null = null;

  ngAfterViewInit(): void {
    this.searchQuery = this.address;
    this.observeMapContainer();
    this.loadMap();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['address'] && changes['address'].currentValue !== this.searchQuery) {
      this.searchQuery = changes['address'].currentValue || '';
    }

    if (changes['expanded']) {
      this.refreshMapViewport(320);
    }
  }

  ngOnDestroy(): void {
    if (this.resizeTimeoutId) {
      clearTimeout(this.resizeTimeoutId);
    }
    if (this.autocompleteTimeoutId) {
      clearTimeout(this.autocompleteTimeoutId);
    }
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    }
    if (this.refreshAnimationFrameId !== null && typeof window !== 'undefined') {
      window.cancelAnimationFrame(this.refreshAnimationFrameId);
    }
    if (this.marker) {
      this.marker.map = null;
    }
    this.marker = null;
    this.map = null;
    this.autocompleteSessionToken = null;
  }

  protected updateSearch(value: string): void {
    this.searchQuery = value;
    this.addressSelected.emit(value);
    this.geocodingStatus = value.trim() ? this.statusLabel(value) : '';
    this.scheduleAutocomplete(value);
  }

  protected showAddressSuggestions(): void {
    if (this.searchQuery.trim().length >= 2) {
      this.scheduleAutocomplete(this.searchQuery, 0);
    }
  }

  protected hideAddressSuggestionsSoon(): void {
    setTimeout(() => {
      this.addressSuggestions.set([]);
    }, 160);
  }

  protected selectAddressSuggestion(suggestion: AddressSuggestion): void {
    void this.selectAutocompletePlace(suggestion.prediction);
  }

  protected submitSearch(): void {
    const query = this.searchQuery.trim();
    if (!query) return;

    this.isSearching = true;
    this.googleMaps.geocodeAddress(query).subscribe({
      next: (result) => {
        this.isSearching = false;
        if (!result) {
          this.geocodingStatus = 'Adresse introuvable sur Google Maps';
          this.applyAddress(query);
          return;
        }
        this.placeMarker(result.latitude, result.longitude);
        this.map?.setCenter(this.toGooglePoint(result));
        this.map?.setZoom(16);
        this.applyAddress(result.formattedAddress, result);
        this.geocodingStatus = this.statusLabel(result.formattedAddress);
      },
      error: () => {
        this.isSearching = false;
        this.geocodingStatus = 'Recherche Google Maps indisponible';
        this.applyAddress(query);
      },
    });
  }

  protected setMapStyle(style: MapStyle): void {
    if (this.mapStyle === style) {
      return;
    }
    this.mapStyle = style;
    this.map?.setMapTypeId(style);
  }

  protected toggleExpanded(): void {
    this.expandedChange.emit(!this.expanded);
  }

  private loadMap(): void {
    if (this.mapLoadStarted) return;
    this.mapLoadStarted = true;
    this.googleMaps
      .load()
      .then((google) => {
        this.google = google;
        this.hasGoogleMap = true;
        this.initializeMapWhenReady();
      })
      .catch(() => {
        this.zone.run(() => {
          this.loading = false;
          this.hasGoogleMap = false;
          this.geocodingStatus =
            'Carte standard disponible, Google Maps attend une cle navigateur valide.';
        });
      });
  }

  private observeMapContainer(): void {
    const container = this.mapContainer?.nativeElement;
    if (!container || typeof ResizeObserver === 'undefined') return;

    this.resizeObserver = new ResizeObserver(() => {
      if (!this.map) {
        this.initializeMapWhenReady();
        return;
      }
      this.refreshMapViewport();
    });
    this.resizeObserver.observe(container);
  }

  private initializeMapWhenReady(): void {
    const google = this.google;
    const container = this.mapContainer?.nativeElement;
    if (!google || !container || this.map) return;

    const { width, height } = container.getBoundingClientRect();
    if (width < 40 || height < 40) {
      this.refreshMapViewport(80);
      return;
    }

    this.zone.runOutsideAngular(() => {
      const map = new google.maps.Map(container, {
        center: this.toGooglePoint(this.dakarCoords),
        zoom: 13,
        mapTypeId: this.mapStyle,
        disableDefaultUI: true,
        zoomControl: true,
        fullscreenControl: false,
        streetViewControl: false,
        mapTypeControl: false,
        clickableIcons: false,
        mapId: google.mapId,
      }) as GoogleMapInstance;

      this.map = map;
      map.addListener('click', (event) => {
        const lat = event.latLng?.lat();
        const lng = event.latLng?.lng();
        if (typeof lat === 'number' && typeof lng === 'number') {
          this.zone.run(() => this.selectCoordinates(lat, lng));
        }
      });

      this.zone.run(() => {
        this.loading = false;
        this.geocodingStatus = this.address ? this.statusLabel(this.address) : '';
        if (this.searchQuery.trim().length >= 2) {
          this.scheduleAutocomplete(this.searchQuery, 0);
        }
        this.cdr.markForCheck();
      });

      this.refreshMapViewport();
    });
  }

  private refreshMapViewport(delayMs = 0): void {
    if (this.resizeTimeoutId) {
      clearTimeout(this.resizeTimeoutId);
    }

    const refresh = () => {
      if (this.refreshAnimationFrameId !== null && typeof window !== 'undefined') {
        window.cancelAnimationFrame(this.refreshAnimationFrameId);
      }

      if (typeof window === 'undefined') {
        this.forceMapRefresh();
        return;
      }

      this.refreshAnimationFrameId = window.requestAnimationFrame(() => {
        this.refreshAnimationFrameId = null;
        this.initializeMapWhenReady();
        this.forceMapRefresh();
      });
    };

    if (delayMs > 0) {
      this.resizeTimeoutId = setTimeout(refresh, delayMs);
      return;
    }

    refresh();
  }

  private forceMapRefresh(): void {
    if (!this.map) return;

    const eventApi = this.google?.maps.event as
      | ({ trigger?: (instance: object, eventName: string) => void } & object)
      | undefined;
    eventApi?.trigger?.(this.map as object, 'resize');
    this.map.setCenter(this.markerPosition() ?? this.toGooglePoint(this.dakarCoords));
    this.map.setMapTypeId(this.mapStyle);
  }

  private markerPosition(): { lat: number; lng: number } | null {
    const position = this.marker?.position;
    if (!position) return null;

    if (
      typeof (position as { lat?: unknown }).lat === 'number' &&
      typeof (position as { lng?: unknown }).lng === 'number'
    ) {
      return position as { lat: number; lng: number };
    }

    const lat = (position as { lat?: unknown }).lat;
    const lng = (position as { lng?: unknown }).lng;
    if (typeof lat === 'function' && typeof lng === 'function') {
      const latitude = lat();
      const longitude = lng();
      return typeof latitude === 'number' && typeof longitude === 'number'
        ? { lat: latitude, lng: longitude }
        : null;
    }

    return null;
  }

  private placeMarker(lat: number, lng: number, label = 'Adresse selectionnee'): void {
    const AdvancedMarkerElement =
      this.google?.maps.marker?.AdvancedMarkerElement;
    if (!AdvancedMarkerElement || !this.map) return;
    const position = { lat, lng };

    if (this.marker) {
      this.marker.position = position;
      this.updateMarkerLabel(label);
      return;
    }

    const content = this.createMarkerContent(label);
    this.marker = new AdvancedMarkerElement({
      position,
      map: this.map,
      title: label,
      content,
    });
  }

  private createMarkerContent(label: string): HTMLElement {
    const content = document.createElement('div');
    content.className = 'jokko-map-marker';
    content.innerHTML = `
      <b>${this.escapeHtml(label)}</b>
      <span></span>
      <i></i>
    `;
    return content;
  }

  private updateMarkerLabel(label: string): void {
    const content = this.marker?.content as HTMLElement | null | undefined;
    const labelElement = content?.querySelector('b');
    if (labelElement) {
      labelElement.textContent = label;
    }
    if (this.marker) {
      this.marker.title = label;
    }
  }

  private scheduleAutocomplete(value: string, delay = 220): void {
    if (this.autocompleteTimeoutId) {
      clearTimeout(this.autocompleteTimeoutId);
    }

    const query = value.trim();
    if (query.length < 2) {
      this.addressSuggestions.set([]);
      this.isLoadingSuggestions.set(false);
      return;
    }

    this.autocompleteTimeoutId = setTimeout(() => {
      void this.loadAddressSuggestions(query);
    }, delay);
  }

  private async loadAddressSuggestions(query: string): Promise<void> {
    const places = this.google?.maps.places;
    if (!places?.AutocompleteSuggestion || !places.AutocompleteSessionToken) {
      this.addressSuggestions.set([]);
      return;
    }

    const requestId = ++this.autocompleteRequestId;
    this.isLoadingSuggestions.set(true);
    this.autocompleteSessionToken ??= new places.AutocompleteSessionToken();

    try {
      const { suggestions } =
        await places.AutocompleteSuggestion.fetchAutocompleteSuggestions({
          input: query,
          includedRegionCodes: ['sn'],
          language: 'fr',
          region: 'sn',
          sessionToken: this.autocompleteSessionToken,
        });
      if (requestId !== this.autocompleteRequestId) return;

      this.zone.run(() => {
        this.addressSuggestions.set(
          suggestions
            .map((suggestion, index) => {
              const prediction = suggestion.placePrediction;
              if (!prediction) return null;
              return {
                id: prediction.placeId || `${query}-${index}`,
                label: prediction.text.toString(),
                prediction,
              };
            })
            .filter((suggestion): suggestion is AddressSuggestion => suggestion !== null)
            .slice(0, 6),
        );
      });
    } catch {
      if (requestId === this.autocompleteRequestId) {
        this.zone.run(() => {
          this.addressSuggestions.set([]);
        });
      }
    } finally {
      if (requestId === this.autocompleteRequestId) {
        this.zone.run(() => {
          this.isLoadingSuggestions.set(false);
        });
      }
    }
  }

  private async selectAutocompletePlace(
    prediction: GoogleMapsPlacePrediction,
  ): Promise<void> {
    const place = prediction.toPlace();

    await place.fetchFields({
      fields: ['displayName', 'formattedAddress', 'location'],
    });
    const location = place.location;
    if (!location) return;

    this.zone.run(() => {
      const address =
        place.formattedAddress || place.displayName || this.searchQuery;
      this.searchQuery = address;
      this.addressSuggestions.set([]);
      this.autocompleteSessionToken = null;
      this.placeMarker(location.lat(), location.lng(), this.markerAddressLabel(address));
      this.map?.setCenter({ lat: location.lat(), lng: location.lng() });
      this.map?.setZoom(16);
      this.applyAddress(address, {
        latitude: location.lat(),
        longitude: location.lng(),
      });
      this.geocodingStatus = this.statusLabel(address);
    });
  }

  private selectCoordinates(lat: number, lng: number): void {
    this.addressSuggestions.set([]);
    this.autocompleteSessionToken = null;

    const coordinate: GoogleMapsCoordinate = { latitude: lat, longitude: lng };
    const fallbackAddress = this.coordinateAreaLabel(lat, lng);
    const requestId = ++this.reverseGeocodeRequestId;

    this.placeMarker(lat, lng, 'Recherche de l adresse...');
    this.searchQuery = fallbackAddress;
    this.applyAddress(fallbackAddress, coordinate);
    this.geocodingStatus = 'Recherche de l adresse...';

    this.googleMaps.reverseGeocode(coordinate).subscribe({
      next: (result) => {
        if (requestId !== this.reverseGeocodeRequestId) return;
        const address = this.humanAddressLabel(result?.formattedAddress || fallbackAddress);
        this.updateMarkerLabel(this.markerAddressLabel(address));
        this.applyAddress(address, coordinate);
        this.geocodingStatus = this.statusLabel(address);
      },
      error: () => {
        if (requestId !== this.reverseGeocodeRequestId) return;
        this.updateMarkerLabel(this.markerAddressLabel(fallbackAddress));
        this.applyAddress(fallbackAddress, coordinate);
        this.geocodingStatus = this.statusLabel(fallbackAddress);
      },
    });
  }

  private applyAddress(value: string, coordinate?: GoogleMapsCoordinate): void {
    this.searchQuery = value;
    this.addressSelected.emit(value);
    if (coordinate) {
      this.addressResolved.emit({ address: value, coordinate });
    }
  }

  private statusLabel(value: string): string {
    return value ? `Adresse selectionnee: ${value.split(',')[0]}` : '';
  }

  private humanAddressLabel(value: string): string {
    return value
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean)
      .slice(0, 4)
      .join(', ');
  }

  private coordinateAreaLabel(_lat: number, _lng: number): string {
    return 'Zone selectionnee sur la carte, Dakar, Senegal';
  }

  private markerAddressLabel(value: string): string {
    const parts = value
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean);
    return parts.slice(0, 3).join(', ') || 'Adresse selectionnee';
  }

  private escapeHtml(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  private toGooglePoint(coordinate: GoogleMapsCoordinate): { lat: number; lng: number } {
    return {
      lat: coordinate.latitude,
      lng: coordinate.longitude,
    };
  }
}
