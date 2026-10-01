import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiResponse } from '../../core/http/api-response.models';
import { unwrapApiResponse, getHttpErrorMessage } from '../../core/http/api-response.utils';
import { AppFeedbackService } from '../../core/feedback/app-feedback.service';
import { AppointmentDocumentRendererService } from '../../features/appointments/presentation/pages/appointment-detail-page/appointment-document-renderer.service';
import { buildInvoiceDocument, InvoiceDocument, InvoiceTemplate } from './invoice-document';

@Injectable({ providedIn: 'root' })
export class InvoiceDocumentService {
  private readonly http = inject(HttpClient);
  private readonly renderer = inject(AppointmentDocumentRendererService);
  private readonly feedback = inject(AppFeedbackService);
  private readonly base = environment.apiUrl;

  loadTemplate() {
    return this.http.get<ApiResponse<InvoiceTemplate>>(`${this.base}/admin/app-settings/invoice`)
      .pipe(map(unwrapApiResponse));
  }

  saveTemplate(template: InvoiceTemplate) {
    return this.http.put<ApiResponse<InvoiceTemplate>>(`${this.base}/admin/app-settings/invoice`, template)
      .pipe(map(unwrapApiResponse));
  }

  uploadImage(file: File) {
    const body = new FormData();
    body.append('image', file);
    return this.http.post<ApiResponse<{ imageUrl: string }>>(`${this.base}/admin/app-settings/invoice/image`, body)
      .pipe(map(unwrapApiResponse));
  }

  downloadReservation(id: string): Promise<boolean> {
    return this.download(`reservations/${encodeURIComponent(id)}`);
  }

  downloadOrder(kind: 'MEDICAMENTS' | 'MATERIEL', id: string): Promise<boolean> {
    return this.download(`orders/${kind}/${encodeURIComponent(id)}`);
  }

  private async download(path: string): Promise<boolean> {
    try {
      const data = await firstValueFrom(this.http.get<ApiResponse<InvoiceDocument>>(`${this.base}/invoices/${path}`)
        .pipe(map(unwrapApiResponse)));
      return await this.renderer.downloadHtmlDocument(
        `facture-${data.reference}.pdf`, 'Facture ' + data.template.brandName, buildInvoiceDocument(data),
      );
    } catch (error) {
      this.feedback.error(getHttpErrorMessage(error, 'Impossible de charger la facture. Réessayez.'));
      return false;
    }
  }
}
