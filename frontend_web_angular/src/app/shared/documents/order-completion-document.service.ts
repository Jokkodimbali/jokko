import { Injectable, inject } from '@angular/core';
import { InvoiceDocumentService } from './invoice-document.service';

export type CompletedOrderDocument = {
  kind: 'MEDICAMENTS' | 'MATERIEL';
  orderId: string;
};

@Injectable({ providedIn: 'root' })
export class OrderCompletionDocumentService {
  private readonly invoices = inject(InvoiceDocumentService);

  download(input: CompletedOrderDocument): Promise<boolean> {
    return this.invoices.downloadOrder(input.kind, input.orderId);
  }
}
