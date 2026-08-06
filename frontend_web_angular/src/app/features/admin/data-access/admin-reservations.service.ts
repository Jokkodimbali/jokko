import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { ApiResponse } from '../../../core/http/api-response.models';
import { unwrapApiResponse } from '../../../core/http/api-response.utils';
import {
  AdminDateRangeQuery,
  AdminReservationDetail,
  AdminReservationsPage,
  AdminReservationStatistics,
} from './admin.models';

@Injectable({ providedIn: 'root' })
export class AdminReservationsService {
  private readonly http = inject(HttpClient);
  private readonly reservationsUrl = `${environment.apiUrl}/admin/reservations`;

  list(query: AdminDateRangeQuery = {}): Observable<AdminReservationsPage> {
    return this.http
      .get<
        ApiResponse<AdminReservationDetail[]>
      >(this.reservationsUrl, { params: this.toParams(query) })
      .pipe(
        map((response) => ({
          items: unwrapApiResponse(response),
          pagination: response.meta?.['pagination'] as AdminReservationsPage['pagination'],
        })),
      );
  }

  statistics(query: AdminDateRangeQuery = {}): Observable<AdminReservationStatistics> {
    return this.http
      .get<ApiResponse<AdminReservationStatistics>>(`${this.reservationsUrl}/statistics`, {
        params: this.toParams(query),
      })
      .pipe(map((response) => unwrapApiResponse(response)));
  }

  get(reservationId: string): Observable<AdminReservationDetail> {
    return this.http
      .get<ApiResponse<AdminReservationDetail>>(`${this.reservationsUrl}/${reservationId}`)
      .pipe(map((response) => unwrapApiResponse(response)));
  }

  private toParams(query: AdminDateRangeQuery): Record<string, string> {
    return Object.entries(query).reduce<Record<string, string>>((params, [key, value]) => {
      if (value !== undefined && value !== null && value !== '') params[key] = String(value);
      return params;
    }, {});
  }
}
