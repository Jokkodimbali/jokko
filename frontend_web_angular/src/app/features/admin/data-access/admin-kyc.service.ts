import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { ApiResponse } from '../../../core/http/api-response.models';
import { unwrapApiResponse } from '../../../core/http/api-response.utils';
import { AdminKycProfile } from './admin.models';

@Injectable({ providedIn: 'root' })
export class AdminKycService {
  private readonly http = inject(HttpClient);
  private readonly kycUrl = `${environment.apiUrl}/admin/kyc`;

  listPending(): Observable<AdminKycProfile[]> {
    return this.http
      .get<ApiResponse<AdminKycProfile[]>>(this.kycUrl, {
        params: { status: 'EN_ATTENTE', limit: 100, offset: 0 },
      })
      .pipe(map((response) => unwrapApiResponse(response)));
  }

  get(profileId: string): Observable<AdminKycProfile> {
    return this.http
      .get<ApiResponse<AdminKycProfile>>(`${this.kycUrl}/${profileId}`)
      .pipe(map((response) => unwrapApiResponse(response)));
  }

  approve(profileId: string): Observable<AdminKycProfile> {
    return this.http
      .patch<ApiResponse<AdminKycProfile>>(`${this.kycUrl}/${profileId}/approve`, {})
      .pipe(map((response) => unwrapApiResponse(response)));
  }

  reject(profileId: string, reason: string): Observable<AdminKycProfile> {
    return this.http
      .patch<ApiResponse<AdminKycProfile>>(`${this.kycUrl}/${profileId}/reject`, { reason })
      .pipe(map((response) => unwrapApiResponse(response)));
  }
}
