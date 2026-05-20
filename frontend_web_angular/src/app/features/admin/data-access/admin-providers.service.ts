import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { ApiResponse } from '../../../core/http/api-response.models';
import { unwrapApiResponse } from '../../../core/http/api-response.utils';
import {
  AdminPaginatedResult,
  AdminProviderListQuery,
  AdminProviderProfile,
} from './admin.models';

@Injectable({ providedIn: 'root' })
export class AdminProvidersService {
  private readonly http = inject(HttpClient);
  private readonly providersUrl = `${environment.apiUrl}/admin/providers`;

  list(query: AdminProviderListQuery = {}): Observable<AdminPaginatedResult<AdminProviderProfile>> {
    return this.http
      .get<ApiResponse<AdminProviderProfile[]>>(this.providersUrl, {
        params: this.toParams(query),
      })
      .pipe(
        map((response) => {
          const pagination = response.meta?.['pagination'] as
            | AdminPaginatedResult<AdminProviderProfile>['pagination']
            | undefined;
          const stats = response.meta?.['stats'] as AdminPaginatedResult<AdminProviderProfile>['stats'] | undefined;
          return {
            items: unwrapApiResponse(response),
            pagination: pagination ?? {
              total: 0,
              page: query.page ?? 1,
              limit: query.limit ?? 12,
              totalPages: 0,
              hasNext: false,
              hasPrevious: false,
            },
            stats,
          };
        }),
      );
  }

  get(providerId: string): Observable<AdminProviderProfile> {
    return this.http
      .get<ApiResponse<AdminProviderProfile>>(`${this.providersUrl}/${providerId}`)
      .pipe(map((response) => unwrapApiResponse(response)));
  }

  activate(providerId: string): Observable<AdminProviderProfile> {
    return this.http
      .patch<ApiResponse<AdminProviderProfile>>(`${this.providersUrl}/${providerId}/activate`, {})
      .pipe(map((response) => unwrapApiResponse(response)));
  }

  deactivate(providerId: string): Observable<AdminProviderProfile> {
    return this.http
      .patch<ApiResponse<AdminProviderProfile>>(`${this.providersUrl}/${providerId}/deactivate`, {})
      .pipe(map((response) => unwrapApiResponse(response)));
  }

  private toParams(query: AdminProviderListQuery): Record<string, string> {
    return Object.entries(query).reduce<Record<string, string>>((params, [key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        params[key] = String(value);
      }
      return params;
    }, {});
  }
}
