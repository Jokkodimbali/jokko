import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpContext } from '@angular/common/http';
import { map } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { ApiResponse } from '../../../core/http/api-response.models';
import { unwrapApiResponse } from '../../../core/http/api-response.utils';
import { SKIP_HTTP_CACHE } from '../../../core/http/http-cache.interceptor';
import { CreateTender, Tender, TenderAction, TenderList } from './tenders.models';
@Injectable({ providedIn: 'root' })
export class TendersService {
  private readonly http = inject(HttpClient);
  private readonly url = `${environment.apiUrl}/tenders`;
  private freshContext() {
    return new HttpContext().set(SKIP_HTTP_CACHE, true);
  }
  preview(input: {
    categoryId: string;
    subCategoryId?: string;
    latitude: number;
    longitude: number;
  }) {
    return this.http
      .get<
        ApiResponse<{ count: number; avatars: { name: string; avatarUrl: string | null }[] }>
      >(`${this.url}/preview`, { params: { ...input }, context: this.freshContext() })
      .pipe(map(unwrapApiResponse));
  }
  list(page = 1, answeredOnly = false) {
    return this.http
      .get<ApiResponse<TenderList>>(this.url, {
        params: { page, ...(answeredOnly ? { answeredOnly: 'true' } : {}) },
        context: this.freshContext(),
      })
      .pipe(map(unwrapApiResponse));
  }
  detail(id: string) {
    return this.http
      .get<ApiResponse<Tender>>(`${this.url}/${id}`, { context: this.freshContext() })
      .pipe(map(unwrapApiResponse));
  }
  create(input: CreateTender) {
    return this.http.post<ApiResponse<Tender>>(this.url, input).pipe(map(unwrapApiResponse));
  }
  act(tender: Tender, action: TenderAction) {
    const suffix =
      action.kind === 'select' || action.kind === 'reject'
        ? `responses/${action.responseId}/${action.kind}`
        : action.kind;
    const body =
      action.kind === 'republish'
        ? { revision: tender.revision, proposedPrice: action.amount }
        : action.kind === 'respond'
          ? {
              revision: tender.revision,
              amount: action.amount,
              serviceId: action.serviceId,
              message: action.message,
            }
          : action.kind === 'select'
            ? { revision: tender.revision, amount: action.amount }
            : { revision: tender.revision };
    return this.http
      .post<ApiResponse<Tender>>(`${this.url}/${tender.id}/${suffix}`, body)
      .pipe(map(unwrapApiResponse));
  }
}
