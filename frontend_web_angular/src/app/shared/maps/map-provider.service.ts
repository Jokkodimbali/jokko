import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpContext } from '@angular/common/http';
import { Observable, firstValueFrom, map, shareReplay } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiResponse } from '../../core/http/api-response.models';
import { unwrapApiResponse } from '../../core/http/api-response.utils';
import { SKIP_HTTP_CACHE } from '../../core/http/http-cache.interceptor';

export type MapPublicConfig = {
  provider: 'google' | 'geoapify';
  geoapifyBrowserApiKey: string;
  browserApiKey: string;
  mapId: string;
};

@Injectable({ providedIn: 'root' })
export class MapProviderService {
  private readonly http = inject(HttpClient);
  readonly config$: Observable<MapPublicConfig> = this.http
    .get<ApiResponse<MapPublicConfig>>(`${environment.apiUrl}/maps/config`, {
      context: new HttpContext().set(SKIP_HTTP_CACHE, true),
    })
    .pipe(map(unwrapApiResponse), shareReplay({ bufferSize: 1, refCount: false }));

  async config(): Promise<MapPublicConfig> {
    return firstValueFrom(this.config$);
  }
}
