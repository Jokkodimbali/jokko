import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { ApiResponse } from '../../../core/http/api-response.models';
import { unwrapApiResponse } from '../../../core/http/api-response.utils';
import { AdminMedicalValidation } from './admin.models';

@Injectable({ providedIn: 'root' })
export class AdminMedicalCredentialsService {
  private readonly http = inject(HttpClient);
  private readonly medicalCredentialsUrl = `${environment.apiUrl}/admin/medical-credentials`;

  listPending(): Observable<AdminMedicalValidation[]> {
    return this.http
      .get<ApiResponse<AdminMedicalValidation[]>>(this.medicalCredentialsUrl)
      .pipe(map((response) => unwrapApiResponse(response)));
  }

  certify(profileId: string): Observable<{ professionalId: string; status: string }> {
    return this.http
      .patch<
        ApiResponse<{ professionalId: string; status: string }>
      >(`${this.medicalCredentialsUrl}/${profileId}/certify`, {})
      .pipe(map((response) => unwrapApiResponse(response)));
  }

  reject(
    profileId: string,
    reason: string,
  ): Observable<{ professionalId: string; status: string }> {
    return this.http
      .patch<
        ApiResponse<{ professionalId: string; status: string }>
      >(`${this.medicalCredentialsUrl}/${profileId}/reject`, { reason })
      .pipe(map((response) => unwrapApiResponse(response)));
  }
}
