import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map, shareReplay } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiResponse } from '../../core/http/api-response.models';
import { unwrapApiResponse } from '../../core/http/api-response.utils';

export type GoogleMapsCoordinate = {
  latitude: number;
  longitude: number;
};

export type GoogleMapsGeocodeResult = GoogleMapsCoordinate & {
  formattedAddress: string;
  placeId: string | null;
};

export type GoogleMapsRouteResult = {
  id: string;
  distanceMeters: number | null;
  durationSeconds: number | null;
  encodedPolyline: string;
  coordinates: GoogleMapsCoordinate[];
  navigationSteps: GoogleMapsNavigationStep[];
};

export type GoogleMapsNavigationStep = {
  id: string;
  instruction: string;
  maneuver: string | null;
  distanceMeters: number | null;
  durationSeconds: number | null;
  start: GoogleMapsCoordinate | null;
  end: GoogleMapsCoordinate | null;
};

type GoogleMapsConfig = {
  browserApiKey: string;
  mapId: string;
};

export type GoogleMapsPoint = { lat: number; lng: number };

export type GoogleMapsMapInstance = {
  setCenter: (coordinate: GoogleMapsPoint) => void;
  setZoom: (zoom: number) => void;
  setMapTypeId: (type: 'roadmap' | 'satellite') => void;
  fitBounds: (
    bounds: GoogleMapsBoundsInstance,
    padding?: number | Record<string, number>,
  ) => void;
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
    Map: new (
      element: HTMLElement,
      options: Record<string, unknown>,
    ) => GoogleMapsMapInstance;
    Polyline: new (
      options: Record<string, unknown>,
    ) => GoogleMapsPolylineInstance;
    LatLngBounds: new () => GoogleMapsBoundsInstance;
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
  }
}

let googleMapsLoadPromise: Promise<GoogleMapsRuntime> | null = null;
let loadedMapId = '';

@Injectable({ providedIn: 'root' })
export class GoogleMapsLoaderService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.apiUrl;
  private readonly config$ = this.http
    .get<ApiResponse<GoogleMapsConfig>>(`${this.apiUrl}/maps/config`)
    .pipe(map(unwrapApiResponse), shareReplay({ bufferSize: 1, refCount: false }));

  load(): Promise<GoogleMapsRuntime> {
    if (typeof window === 'undefined') {
      return Promise.reject(new Error('Google Maps requires a browser runtime.'));
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
          const apiKey = config.browserApiKey || environment.googleMapsApiKey;
          if (!apiKey) {
            reject(new Error('Google Maps API key is missing.'));
            return;
          }
          loadedMapId = config.mapId || 'DEMO_MAP_ID';

          const existingScript = document.querySelector<HTMLScriptElement>(
            'script[data-jokko-google-maps]',
          );
          if (existingScript) {
            const runtime = this.googleRuntime(loadedMapId);
            if (runtime?.maps) {
              resolve(runtime);
              return;
            }
            existingScript.addEventListener(
              'load',
              () => resolve(this.requireGoogleRuntime()),
              { once: true },
            );
            existingScript.addEventListener('error', () => reject(new Error('Google Maps failed to load.')));
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

  geocodeAddress(address: string): Observable<GoogleMapsGeocodeResult | null> {
    return this.http
      .get<ApiResponse<GoogleMapsGeocodeResult | null>>(`${this.apiUrl}/maps/geocode`, {
        params: { address },
      })
      .pipe(map(unwrapApiResponse));
  }

  computeRoutes(input: {
    origin: GoogleMapsCoordinate;
    destination: GoogleMapsCoordinate;
  }): Observable<GoogleMapsRouteResult[]> {
    return this.http
      .post<ApiResponse<GoogleMapsRouteResult[]>>(`${this.apiUrl}/maps/routes`, input)
      .pipe(map(unwrapApiResponse));
  }

  reverseGeocode(
    coordinate: GoogleMapsCoordinate,
  ): Observable<GoogleMapsGeocodeResult | null> {
    return this.http
      .get<ApiResponse<GoogleMapsGeocodeResult | null>>(
        `${this.apiUrl}/maps/reverse-geocode`,
        {
          params: {
            latitude: coordinate.latitude,
            longitude: coordinate.longitude,
          },
        },
      )
      .pipe(map(unwrapApiResponse));
  }

  private googleRuntime(mapId: string): GoogleMapsRuntime | undefined {
    const google = (window as unknown as {
      google?: Omit<GoogleMapsRuntime, 'mapId'>;
    }).google;
    return google?.maps
      ? { maps: google.maps, mapId: mapId || 'DEMO_MAP_ID' }
      : undefined;
  }

  private requireGoogleRuntime(): GoogleMapsRuntime {
    const runtime = this.googleRuntime(loadedMapId);
    if (!runtime) {
      throw new Error('Google Maps runtime unavailable after script load.');
    }
    return runtime;
  }
}
