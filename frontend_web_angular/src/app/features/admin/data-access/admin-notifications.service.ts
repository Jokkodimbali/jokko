import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { ApiResponse } from '../../../core/http/api-response.models';
import { unwrapApiResponse } from '../../../core/http/api-response.utils';
import { AdminBroadcastPayload, AdminBroadcastResult } from './admin.models';

@Injectable({ providedIn: 'root' })
export class AdminNotificationsService {
  private readonly http = inject(HttpClient);

  broadcast(payload: AdminBroadcastPayload): Observable<AdminBroadcastResult> {
    return this.http
      .post<ApiResponse<AdminBroadcastResult>>(`${environment.apiUrl}/admin/notifications/broadcast`, payload)
      .pipe(map((response) => unwrapApiResponse(response)));
  }
}
