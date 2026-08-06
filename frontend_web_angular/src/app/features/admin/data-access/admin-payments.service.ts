import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { ApiResponse } from '../../../core/http/api-response.models';
import { unwrapApiResponse } from '../../../core/http/api-response.utils';
import {
  AdminEscrowProcessResult,
  AdminPayment,
  AdminPaymentRefundResult,
  AdminPaymentsQuery,
  AdminPaymentsReport,
  AdminPaymentStatistics,
  AdminPendingEscrowPayment,
} from './admin.models';

@Injectable({ providedIn: 'root' })
export class AdminPaymentsService {
  private readonly http = inject(HttpClient);
  private readonly paymentsUrl = `${environment.apiUrl}/admin/payments`;

  list(query: AdminPaymentsQuery = {}): Observable<AdminPaymentsReport> {
    return this.http
      .get<ApiResponse<AdminPaymentsReport>>(this.paymentsUrl, { params: this.toParams(query) })
      .pipe(map((response) => unwrapApiResponse(response)));
  }

  statistics(): Observable<AdminPaymentStatistics> {
    return this.http
      .get<ApiResponse<AdminPaymentStatistics>>(`${this.paymentsUrl}/statistics`)
      .pipe(map((response) => unwrapApiResponse(response)));
  }

  get(paymentId: string): Observable<AdminPayment> {
    return this.http
      .get<ApiResponse<AdminPayment>>(`${this.paymentsUrl}/${paymentId}`)
      .pipe(map((response) => unwrapApiResponse(response)));
  }

  refund(paymentId: string, reason: string): Observable<AdminPaymentRefundResult> {
    return this.http
      .post<
        ApiResponse<AdminPaymentRefundResult>
      >(`${this.paymentsUrl}/${paymentId}/refund`, { reason })
      .pipe(map((response) => unwrapApiResponse(response)));
  }

  pendingEscrow(): Observable<AdminPendingEscrowPayment[]> {
    return this.http
      .get<ApiResponse<AdminPendingEscrowPayment[]>>(`${this.paymentsUrl}/escrow/pending`)
      .pipe(map((response) => unwrapApiResponse(response)));
  }

  processPendingEscrow(): Observable<AdminEscrowProcessResult> {
    return this.http
      .post<ApiResponse<AdminEscrowProcessResult>>(`${this.paymentsUrl}/escrow/process-pending`, {})
      .pipe(map((response) => unwrapApiResponse(response)));
  }

  private toParams(query: AdminPaymentsQuery): Record<string, string> {
    return Object.entries(query).reduce<Record<string, string>>((params, [key, value]) => {
      if (value !== undefined && value !== null && value !== '') params[key] = String(value);
      return params;
    }, {});
  }
}
