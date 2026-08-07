import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { map } from 'rxjs';
import { environment } from '../../../../environments/environment';
import type { ApiResponse } from '../../../core/http/api-response.models';
import { unwrapApiResponse } from '../../../core/http/api-response.utils';
import type { ActiveCallSnapshot, CallHistoryItem } from '../domain/call.models';

@Injectable({ providedIn: 'root' })
export class CallsApiService {
  private readonly http = inject(HttpClient);
  createJoinCredential(conversationId: string, callId: string) {
    return this.http
      .post<
        ApiResponse<{ serverUrl: string; token: string }>
      >(`${environment.apiUrl}/calls/conversations/${conversationId}/join-credential`, { callId })
      .pipe(map(unwrapApiResponse));
  }

  getActiveCall() {
    return this.http
      .get<ApiResponse<ActiveCallSnapshot | null>>(`${environment.apiUrl}/calls/active`)
      .pipe(map(unwrapApiResponse));
  }

  listHistory() {
    return this.http
      .get<ApiResponse<CallHistoryItem[]>>(`${environment.apiUrl}/calls/history`)
      .pipe(map(unwrapApiResponse));
  }
}
