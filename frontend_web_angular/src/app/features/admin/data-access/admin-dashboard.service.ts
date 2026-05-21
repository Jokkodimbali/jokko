import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { ApiResponse } from '../../../core/http/api-response.models';
import { unwrapApiResponse } from '../../../core/http/api-response.utils';
import {
  AdminDashboard,
  AdminRegionsReport,
  AdminRevenuePeriod,
  AdminRevenueReport,
} from './admin.models';

@Injectable({ providedIn: 'root' })
export class AdminDashboardService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/admin/dashboard`;

  getDashboard(): Observable<AdminDashboard> {
    return this.http
      .get<ApiResponse<AdminDashboard>>(this.apiUrl)
      .pipe(map((response) => unwrapApiResponse(response)));
  }

  getRevenue(period: AdminRevenuePeriod = '12m'): Observable<AdminRevenueReport> {
    return this.http
      .get<ApiResponse<AdminRevenueReport>>(`${environment.apiUrl}/admin/revenue`, {
        params: { period },
      })
      .pipe(map((response) => unwrapApiResponse(response)));
  }

  getRegions(): Observable<AdminRegionsReport> {
    return this.http
      .get<ApiResponse<AdminRegionsReport>>(`${environment.apiUrl}/admin/regions`)
      .pipe(map((response) => unwrapApiResponse(response)));
  }
}
