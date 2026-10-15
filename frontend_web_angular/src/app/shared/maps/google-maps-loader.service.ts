import { Injectable, inject } from '@angular/core';
import { Subject } from 'rxjs';
import { environment } from '../../../environments/environment';
import type { GeocodedAddress, MapCoordinate, MapNavigationStep, MapRouteResult, MapPoint } from './map.models';
import { MapProviderService } from './map-provider.service';

/** Kept as type aliases for existing Google-specific integrations. */
export type GoogleMapsCoordinate = MapCoordinate;
export type GoogleMapsGeocodeResult = GeocodedAddress;
export type GoogleMapsRouteResult = MapRouteResult;
export type GoogleMapsNavigationStep = MapNavigationStep;

export type GoogleMapsPoint = MapPoint;
export type GoogleMapsPixel = { x: number; y: number };

export type GoogleMapsOverlayViewInstance = {
  setMap: (map: GoogleMapsMapInstance | null) => void;
  getProjection: () => {
    fromLatLngToDivPixel: (point: GoogleMapsPoint) => GoogleMapsPixel | null;
    fromDivPixelToLatLng: (
      pixel: GoogleMapsPixel,
    ) => GoogleMapsPoint | { lat: () => number; lng: () => number } | null;
  } | null;
  onAdd: () => void;
  draw: () => void;
  onRemove: () => void;
};

export type GoogleMapsMapInstance = {
  setCenter: (coordinate: GoogleMapsPoint) => void;
  getCenter?: () => { lat: () => number; lng: () => number } | null | undefined;
  setZoom: (zoom: number) => void;
  getZoom?: () => number | undefined;
  setMapTypeId: (type: 'roadmap' | 'satellite' | 'hybrid') => void;
  getHeading?: () => number;
  setHeading?: (heading: number) => void;
  setTilt?: (tilt: number) => void;
  moveCamera?: (cameraOptions: {
    center?: GoogleMapsPoint;
    zoom?: number;
    heading?: number;
    tilt?: number;
  }) => void;
  setOptions?: (options: Record<string, unknown>) => void;
  getRenderingType?: () => 'VECTOR' | 'RASTER' | string;
  fitBounds: (bounds: GoogleMapsBoundsInstance, padding?: number | Record<string, number>) => void;
  addListener: (
    eventName: string,
    handler: (event: {
      latLng?: {
        lat: () => number;
        lng: () => number;
      };
    }) => void,
  ) => unknown;
};

export type GoogleMapsAdvancedMarkerInstance = {
  content?: Node | null;
  map: GoogleMapsMapInstance | null;
  position?:
    | GoogleMapsPoint
    | {
        lat: () => number;
        lng: () => number;
      }
    | null;
  title?: string;
};

export type GoogleMapsPolylineInstance = {
  setMap: (map: GoogleMapsMapInstance | null) => void;
  setOptions: (options: Record<string, unknown>) => void;
  setPath: (path: GoogleMapsPoint[]) => void;
  addListener: (eventName: string, handler: () => void) => unknown;
};

export type GoogleMapsBoundsInstance = {
  extend: (coordinate: GoogleMapsPoint) => void;
};

export type GoogleMapsRuntime = {
  mapId: string;
  maps: {
    Map: new (element: HTMLElement, options: Record<string, unknown>) => GoogleMapsMapInstance;
    Polyline: new (options: Record<string, unknown>) => GoogleMapsPolylineInstance;
    LatLngBounds: new () => GoogleMapsBoundsInstance;
    OverlayView?: new () => GoogleMapsOverlayViewInstance;
    marker?: {
      AdvancedMarkerElement: new (
        options: Record<string, unknown>,
      ) => GoogleMapsAdvancedMarkerInstance;
    };
    places?: {
      PlaceAutocompleteElement: new (
        options?: Record<string, unknown>,
      ) => GoogleMapsPlaceAutocompleteElement;
      AutocompleteSessionToken: new () => GoogleMapsAutocompleteSessionToken;
      AutocompleteSuggestion: {
        fetchAutocompleteSuggestions: (
          request: GoogleMapsAutocompleteRequest,
        ) => Promise<{ suggestions: GoogleMapsAutocompleteSuggestion[] }>;
      };
    };
    event?: {
      clearInstanceListeners: (instance: object) => void;
    };
  };
};

export type GoogleMapsPlace = {
  displayName?: string;
  formattedAddress?: string;
  location?: {
    lat: () => number;
    lng: () => number;
  };
  fetchFields: (options: { fields: string[] }) => Promise<void>;
};

export type GoogleMapsPlaceAutocompleteElement = HTMLElement & {
  includedRegionCodes?: string[];
  placeholder?: string;
  value?: string;
  addEventListener: (
    eventName: 'gmp-select' | 'input',
    handler: EventListenerOrEventListenerObject,
  ) => void;
};

export type GoogleMapsAutocompleteSessionToken = object;

export type GoogleMapsAutocompleteRequest = {
  input: string;
  includedRegionCodes?: string[];
  language?: string;
  region?: string;
  sessionToken?: GoogleMapsAutocompleteSessionToken;
};

export type GoogleMapsPlacePrediction = {
  placeId?: string;
  text: { toString: () => string };
  toPlace: () => GoogleMapsPlace;
};

export type GoogleMapsAutocompleteSuggestion = {
  placePrediction?: GoogleMapsPlacePrediction;
};

declare global {
  interface Window {
    __jokkoGoogleMapsLoaded?: () => void;
    gm_authFailure?: () => void;
  }
}

let googleMapsLoadPromise: Promise<GoogleMapsRuntime> | null = null;
let loadedMapId = '';
let googleMapsAuthenticationFailed = false;

@Injectable({ providedIn: 'root' })
export class GoogleMapsLoaderService {
  private readonly provider = inject(MapProviderService);
  private readonly authenticationFailure = new Subject<void>();
  readonly authenticationFailed$ = this.authenticationFailure.asObservable();
  private readonly config$ = this.provider.config$;

  load(): Promise<GoogleMapsRuntime> {
    if (typeof window === 'undefined') {
      return Promise.reject(new Error('Google Maps requires a browser runtime.'));
    }
    if (googleMapsAuthenticationFailed) {
      return Promise.reject(new Error('Google Maps authentication failed.'));
    }
    const currentGoogle = this.googleRuntime(loadedMapId);
    if (currentGoogle?.maps) {
      return Promise.resolve(currentGoogle);
    }
    if (googleMapsLoadPromise) {
      return googleMapsLoadPromise;
    }

    const loadPromise = new Promise<GoogleMapsRuntime>((resolve, reject) => {
      this.config$.subscribe({
        next: (config) => {
          if (config.provider === 'geoapify') {
            reject(new Error('Google Maps est desactive : fournisseur Geoapify actif.'));
            return;
          }
          const apiKey = config.browserApiKey || environment.googleMapsApiKey;
          if (!apiKey) {
            reject(new Error('Google Maps API key is missing.'));
            return;
          }
          loadedMapId = config.mapId || 'DEMO_MAP_ID';
          window.gm_authFailure = () => {
            googleMapsAuthenticationFailed = true;
            this.authenticationFailure.next();
            reject(new Error('Google Maps authentication failed.'));
          };

          const existingScript = document.querySelector<HTMLScriptElement>(
            'script[data-jokko-google-maps]',
          );
          if (existingScript) {
            const runtime = this.googleRuntime(loadedMapId);
            if (runtime?.maps) {
              resolve(runtime);
              return;
            }
            existingScript.addEventListener('load', () => resolve(this.requireGoogleRuntime()), {
              once: true,
            });
            existingScript.addEventListener('error', () =>
              reject(new Error('Google Maps failed to load.')),
            );
            return;
          }

          window.__jokkoGoogleMapsLoaded = () => resolve(this.requireGoogleRuntime());

          const script = document.createElement('script');
          const params = new URLSearchParams({
            key: apiKey,
            libraries: 'places,marker',
            language: 'fr',
            region: 'SN',
            loading: 'async',
            v: 'weekly',
            callback: '__jokkoGoogleMapsLoaded',
          });
          script.src = `https://maps.googleapis.com/maps/api/js?${params.toString()}`;
          script.async = true;
          script.defer = true;
          script.setAttribute('data-jokko-google-maps', 'true');
          script.onerror = () => {
            script.remove();
            reject(new Error('Google Maps failed to load.'));
          };
          document.head.appendChild(script);
        },
        error: () => reject(new Error('Google Maps config unavailable.')),
      });
    });

    googleMapsLoadPromise = loadPromise;
    loadPromise.catch(() => {
      if (googleMapsLoadPromise === loadPromise) {
        googleMapsLoadPromise = null;
      }
      delete window.__jokkoGoogleMapsLoaded;
    });

    return loadPromise;
  }

  private googleRuntime(mapId: string): GoogleMapsRuntime | undefined {
    const google = (
      window as unknown as {
        google?: Omit<GoogleMapsRuntime, 'mapId'>;
      }
    ).google;
    return google?.maps ? { maps: google.maps, mapId: mapId || 'DEMO_MAP_ID' } : undefined;
  }

  private requireGoogleRuntime(): GoogleMapsRuntime {
    const runtime = this.googleRuntime(loadedMapId);
    if (!runtime) {
      throw new Error('Google Maps runtime unavailable after script load.');
    }
    return runtime;
  }
}
