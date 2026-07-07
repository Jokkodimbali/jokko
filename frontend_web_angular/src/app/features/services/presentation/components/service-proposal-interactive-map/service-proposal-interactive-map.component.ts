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

  ngAfterViewInit(): void {
    this.searchQuery = this.address;
    this.loadMap();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['address'] && changes['address'].currentValue !== this.searchQuery) {
      this.searchQuery = changes['address'].currentValue || '';
    }

    if (changes['expanded'] && this.map) {
      this.resizeTimeoutId = setTimeout(() => {
        this.map?.setCenter(this.toGooglePoint(this.dakarCoords));
      }, 310);
    }
  }

  ngOnDestroy(): void {
    if (this.resizeTimeoutId) {
      clearTimeout(this.resizeTimeoutId);
    }
    if (this.autocompleteTimeoutId) {
      clearTimeout(this.autocompleteTimeoutId);
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
    this.googleMaps
      .load()
      .then((google) => {
        this.google = google;
        this.hasGoogleMap = true;
        this.zone.runOutsideAngular(() => {
          const container = this.mapContainer?.nativeElement;
          if (!container || this.map) return;

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
          });
        });
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

  private placeMarker(lat: number, lng: number): void {
    const AdvancedMarkerElement =
      this.google?.maps.marker?.AdvancedMarkerElement;
    if (!AdvancedMarkerElement || !this.map) return;
    const position = { lat, lng };

    if (this.marker) {
      this.marker.position = position;
      return;
    }

    const content = document.createElement('div');
    content.className = 'jokko-map-marker';
    content.innerHTML = '<span></span><i></i>';
    this.marker = new AdvancedMarkerElement({
      position,
      map: this.map,
      title: 'Adresse selectionnee',
      content,
    });
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
      this.placeMarker(location.lat(), location.lng());
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
    this.placeMarker(lat, lng);
    const coordinates = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    this.searchQuery = coordinates;
    this.applyAddress(coordinates, { latitude: lat, longitude: lng });
    this.geocodingStatus = 'Coordonnees GPS selectionnees';
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

  private toGooglePoint(coordinate: GoogleMapsCoordinate): { lat: number; lng: number } {
    return {
      lat: coordinate.latitude,
      lng: coordinate.longitude,
    };
  }
}
