import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiResponse } from '../../core/http/api-response.models';
import { unwrapApiResponse } from '../../core/http/api-response.utils';
import type { GeocodedAddress, MapCoordinate, MapRouteResult } from './map.models';

/** Provider-neutral API used by all address and routing flows. */
@Injectable({ providedIn: 'root' })
export class MapsApiService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.apiUrl;

  geocodeAddress(address: string): Observable<GeocodedAddress | null> {
    return this.http
      .get<ApiResponse<GeocodedAddress | null>>(`${this.apiUrl}/maps/geocode`, {
        params: { address },
      })
      .pipe(map(unwrapApiResponse));
  }

  autocomplete(text: string): Observable<GeocodedAddress[]> {
    return this.http
      .get<ApiResponse<GeocodedAddress[]>>(`${this.apiUrl}/maps/autocomplete`, {
        params: { text },
      })
      .pipe(map(unwrapApiResponse));
  }

  reverseGeocode(coordinate: MapCoordinate): Observable<GeocodedAddress | null> {
    return this.http
      .get<ApiResponse<GeocodedAddress | null>>(`${this.apiUrl}/maps/reverse-geocode`, {
        params: {
          latitude: coordinate.latitude,
          longitude: coordinate.longitude,
        },
      })
      .pipe(map(unwrapApiResponse));
  }

  computeRoutes(input: {
    origin: MapCoordinate;
    destination: MapCoordinate;
    alternatives?: boolean;
  }): Observable<MapRouteResult[]> {
    return this.http
      .post<ApiResponse<MapRouteResult[]>>(`${this.apiUrl}/maps/routes`, input)
      .pipe(map(unwrapApiResponse));
  }
}
