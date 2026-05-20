import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { ApiResponse } from '../../../core/http/api-response.models';
import { unwrapApiResponse } from '../../../core/http/api-response.utils';
import { AdminDisputeCase } from './admin.models';

@Injectable({ providedIn: 'root' })
export class AdminDisputesService {
  private readonly http = inject(HttpClient);
  private readonly disputesUrl = `${environment.apiUrl}/admin/disputes`;

  listOpen(limit = 100): Observable<AdminDisputeCase[]> {
    const params = new HttpParams().set('limit', limit);
    return this.http
      .get<ApiResponse<AdminDisputeCase[]>>(this.disputesUrl, { params })
      .pipe(map((response) => unwrapApiResponse(response)));
  }

  markInReview(disputeId: string): Observable<AdminDisputeCase> {
    return this.http
      .patch<ApiResponse<AdminDisputeCase>>(`${this.disputesUrl}/${disputeId}/in-review`, {})
      .pipe(map((response) => unwrapApiResponse(response)));
  }

  refundClient(disputeId: string, notes: string): Observable<AdminDisputeCase> {
    return this.resolve(disputeId, {
      decision: 'REMBOURSER_CLIENT',
      clientRefundPercentage: 100,
      notes,
    });
  }

  creditProfessional(disputeId: string, notes: string): Observable<AdminDisputeCase> {
    return this.resolve(disputeId, {
      decision: 'CREDITER_PRESTATAIRE',
      clientRefundPercentage: 0,
      notes,
    });
  }

  sendMessage(
    disputeId: string,
    recipient: 'CLIENT' | 'PRESTATAIRE' | 'TOUS',
    content: string,
  ): Observable<unknown> {
    return this.http
      .post<ApiResponse<unknown>>(`${this.disputesUrl}/${disputeId}/messages`, {
        recipient,
        content,
      })
      .pipe(map((response) => unwrapApiResponse(response)));
  }

  private resolve(
    disputeId: string,
    payload: {
      decision: 'REMBOURSER_CLIENT' | 'CREDITER_PRESTATAIRE' | 'PARTAGER';
      clientRefundPercentage: number;
      notes: string;
    },
  ): Observable<AdminDisputeCase> {
    return this.http
      .patch<ApiResponse<{ dispute: AdminDisputeCase }>>(`${this.disputesUrl}/${disputeId}/resolve`, payload)
      .pipe(map((response) => unwrapApiResponse(response).dispute));
  }
}
