import { Injectable } from '@angular/core';
import { MaterialQuoteView } from '../../../data-access/service-proposal.service';

export type MaterialQuoteAuthor = 'CLIENT' | 'PRESTATAIRE';
export type MaterialQuoteStatus = 'EN_ATTENTE' | 'VALIDE' | 'REFUSE';

export interface MaterialQuoteDraft {
  designation: string;
  unitPrice: number | null;
  quantity: number;
  author: MaterialQuoteAuthor;
}

export interface MaterialQuoteEntry extends MaterialQuoteDraft {
  id: string;
  negotiationId: string;
  reservationId: string | null;
  createdByUserId: string;
  unitPrice: number;
  status: MaterialQuoteStatus;
  clientValidatedAt: string | null;
  providerValidatedAt: string | null;
  rejectedBy: MaterialQuoteAuthor | null;
  pdfUrl: string | null;
}

@Injectable({ providedIn: 'root' })
export class ServiceProposalMaterialQuoteService {
  toLocalEntry(params: {
    designation: string;
    unitPrice: number;
    quantity: number;
    userId: string;
    author: MaterialQuoteAuthor;
  }): MaterialQuoteEntry {
    return {
      id: `local-${Date.now()}`,
      negotiationId: '',
      reservationId: null,
      createdByUserId: params.userId,
      designation: params.designation,
      unitPrice: params.unitPrice,
      quantity: params.quantity,
      author: params.author,
      status: 'EN_ATTENTE',
      clientValidatedAt: null,
      providerValidatedAt: null,
      rejectedBy: null,
      pdfUrl: null,
    };
  }

  toEntry(quote: MaterialQuoteView): MaterialQuoteEntry {
    return {
      id: quote.id,
      negotiationId: quote.negotiationId,
      reservationId: quote.reservationId,
      createdByUserId: quote.createdByUserId,
      designation: quote.designation,
      unitPrice: quote.unitPrice,
      quantity: quote.quantity,
      author: quote.createdBy,
      status: quote.status,
      clientValidatedAt: quote.clientValidatedAt,
      providerValidatedAt: quote.providerValidatedAt,
      rejectedBy: quote.rejectedBy,
      pdfUrl: quote.pdfUrl,
    };
  }

  authorLabel(entry: MaterialQuoteEntry): string {
    return entry.author === 'PRESTATAIRE' ? 'PRESTATAIRE' : 'VOUS';
  }

  draftAuthorLabel(isProviderProposalMode: boolean): string {
    return isProviderProposalMode ? 'PRESTATAIRE' : 'VOUS';
  }

  isValidatedByViewer(entry: MaterialQuoteEntry, isProviderProposalMode: boolean): boolean {
    return isProviderProposalMode
      ? Boolean(entry.providerValidatedAt) || entry.status === 'VALIDE'
      : Boolean(entry.clientValidatedAt) || entry.status === 'VALIDE';
  }

  statusLabel(entry: MaterialQuoteEntry, isProviderProposalMode: boolean): string {
    if (entry.status === 'EN_ATTENTE') {
      return isProviderProposalMode ? 'EN ATTENTE CLIENT' : 'EN ATTENTE';
    }
    if (entry.status === 'REFUSE') {
      return 'REFUSE';
    }
    return this.isValidatedByViewer(entry, isProviderProposalMode) ? 'VALIDE PAR VOUS' : 'VALIDE';
  }
}
