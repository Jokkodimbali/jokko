import { Injectable, inject } from '@angular/core';
import { AppointmentDocumentRendererService } from '../../features/appointments/presentation/pages/appointment-detail-page/appointment-document-renderer.service';

export type CompletedOrderDocument = {
  kind: 'MEDICAMENTS' | 'MATERIEL';
  orderId: string;
  merchantName: string;
  clientName: string;
  items: Array<{ name: string; quantity?: number; unitPrice: number }>;
  deliveryRequested: boolean;
  deliveryAmount: number | null;
  totalAmount: number;
};

@Injectable({ providedIn: 'root' })
export class OrderCompletionDocumentService {
  private readonly renderer = inject(AppointmentDocumentRendererService);
  private readonly currency = new Intl.NumberFormat('fr-FR');

  download(input: CompletedOrderDocument): Promise<boolean> {
    const label = input.kind === 'MEDICAMENTS' ? 'Ordonnance et livraison' : 'Commande de matériel';
    const productsAmount = input.items.reduce(
      (total, item) => total + item.unitPrice * Math.max(1, item.quantity ?? 1),
      0,
    );
    const itemRows = input.items
      .map((item) => {
        const quantity = Math.max(1, item.quantity ?? 1);
        return `<tr><td>${this.escape(item.name)}</td><td class="right">${quantity}</td><td class="right">${this.amount(item.unitPrice)}</td><td class="right">${this.amount(item.unitPrice * quantity)}</td></tr>`;
      })
      .join('');
    const deliveryRow = input.deliveryRequested
      ? `<p class="right"><b>Livraison :</b> ${this.amount(input.deliveryAmount ?? 0)}</p>`
      : '';
    const body = `<div class="order-completion-document">
      <div class="top"><div><span class="brand">Jokko</span><h1>${label}</h1><p class="muted">Commande #${this.escape(input.orderId.slice(0, 8).toUpperCase())}</p></div><div class="right"><span class="pill">LIVRÉE</span><p class="muted">Document généré le ${this.escape(new Date().toLocaleDateString('fr-FR'))}</p></div></div>
      <div class="grid"><div class="box"><b>${input.kind === 'MEDICAMENTS' ? 'Pharmacie' : 'Quincaillerie'}</b><p>${this.escape(input.merchantName)}</p></div><div class="box"><b>Client</b><p>${this.escape(input.clientName)}</p></div></div>
      <h2>${input.kind === 'MEDICAMENTS' ? 'Médicaments facturés' : 'Articles facturés'}</h2>
      <table><thead><tr><th>Désignation</th><th class="right">Qté</th><th class="right">Prix unitaire</th><th class="right">Montant</th></tr></thead><tbody>${itemRows || '<tr><td colspan="4">Aucun article facturé.</td></tr>'}</tbody></table>
      <div class="invoice-total"><p>Articles : ${this.amount(productsAmount)}</p>${deliveryRow}<div class="total">Total payé : ${this.amount(input.totalAmount)}</div></div>
      <p class="footer-note">Ce récapitulatif confirme les articles remis et, lorsqu’elle a été demandée, la livraison.</p>
    </div>`;
    const filePrefix = input.kind === 'MEDICAMENTS' ? 'ordonnance-livree' : 'materiel-livre';
    return this.renderer.downloadHtmlDocument(
      `${filePrefix}-jokko-${input.orderId.slice(0, 8)}.pdf`,
      label,
      body,
    );
  }

  private amount(value: number): string {
    return `${this.currency.format(Math.round(value))} FCFA`;
  }

  private escape(value: string): string {
    return value.replace(
      /[&<>'"]/g,
      (character) =>
        ({
          '&': '&amp;',
          '<': '&lt;',
          '>': '&gt;',
          "'": '&#39;',
          '"': '&quot;',
        })[character] ?? character,
    );
  }
}
