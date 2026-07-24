import { Injectable } from '@angular/core';
import {
  CreateReservationFromNegotiationPayload,
  NegotiationView,
} from '../../../data-access/service-proposal.service';
import { BackendProfessionalDetailService } from '../../../domain/models/services.models';

export type PaymentMethod = 'WAVE' | 'ORANGE_MONEY' | 'VISA';

export interface ReservationDraft {
  service: BackendProfessionalDetailService;
  amount: number;
  dateHeure: string;
  adresseClient: string;
  dureeMinutes: number;
  paymentMethod: PaymentMethod;
}

@Injectable({ providedIn: 'root' })
export class ServiceProposalReservationBuilderService {
  buildProposalMessage(input: {
    draft: ReservationDraft;
    serviceName: string;
    amountLabel: string;
    proposalDateLabel: string;
    isParcelDeliveryService: boolean;
    parcelNotes: string[];
  }): string {
    const lines = [
      `Service: ${input.serviceName}.`,
      `Proposition de prix: ${input.amountLabel} FCFA.`,
      `Date souhaitee: ${input.proposalDateLabel}.`,
      `Adresse: ${input.draft.adresseClient}.`,
      `Duree: ${input.draft.dureeMinutes} minutes.`,
      `Paiement choisi: ${input.draft.paymentMethod}.`,
    ];

    if (input.isParcelDeliveryService) {
      lines.push(...input.parcelNotes);
    }

    return this.joinLimitedNotes(lines);
  }

  buildAcceptedReservationNotes(input: {
    proposal: NegotiationView;
    acceptedAmountLabel: string;
    parcelNotes: string[];
  }): string {
    const lines = [
      `Reservation creee apres acceptation du prix propose: ${input.acceptedAmountLabel} FCFA.`,
      ...input.parcelNotes,
    ];

    if (input.parcelNotes.length === 0) {
      const parcelMessage = this.extractParcelMessageFromProposal(input.proposal);
      if (parcelMessage) {
        lines.push(parcelMessage);
      }
    }

    return this.joinLimitedNotes(lines);
  }

  buildAcceptedNegotiationReservationPayload(input: {
    proposal: NegotiationView;
    dateHeure: string | null;
    adresseClient: string;
    dureeMinutes: number;
  }): CreateReservationFromNegotiationPayload | null {
    if (
      !input.proposal.id ||
      !input.dateHeure ||
      !input.adresseClient ||
      !Number.isInteger(input.dureeMinutes) ||
      input.dureeMinutes < 5 ||
      input.dureeMinutes > 1440
    ) {
      return null;
    }

    return {
      negotiationId: input.proposal.id,
      dateHeure: input.dateHeure,
      adresseClient: input.adresseClient,
      dureeMinutes: input.dureeMinutes,
    };
  }

  buildFallbackReservationDraft(input: {
    service: BackendProfessionalDetailService;
    fallbackAmount: number;
    dateHeure: string;
    adresseClient: string;
    dureeMinutes: number;
    paymentMethod: PaymentMethod;
  }): ReservationDraft {
    return {
      service: input.service,
      amount:
        Number.isFinite(input.fallbackAmount) && input.fallbackAmount > 0
          ? Math.trunc(input.fallbackAmount)
          : input.service.prix || 0,
      dateHeure: input.dateHeure,
      adresseClient: input.adresseClient,
      dureeMinutes: input.dureeMinutes,
      paymentMethod: input.paymentMethod,
    };
  }

  private extractParcelMessageFromProposal(proposal: NegotiationView): string {
    const offer = [...(proposal.propositions ?? [])]
      .reverse()
      .find((item) => item.message?.includes('Colis '));

    return offer?.message?.trim().replace(/\s+/g, ' ') ?? '';
  }

  joinLimitedNotes(lines: string[], maxLength = 950): string {
    const text = lines.filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
    if (text.length <= maxLength) {
      return text;
    }

    return `${text.slice(0, maxLength - 3).trim()}...`;
  }
}
