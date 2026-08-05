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
    const requestedServiceName = this.extractRequestedServiceName(input.proposal);
    const localParcelNotes = input.parcelNotes.join(' ');
    const hasCompleteLocalContacts =
      this.hasCompleteParcelContacts(localParcelNotes);
    const recoveredParcelMessage = hasCompleteLocalContacts
      ? ''
      : this.extractParcelMessageFromProposal(input.proposal);
    const lines = [
      requestedServiceName ? `Motif reserve: ${requestedServiceName}.` : '',
      `Reservation creee apres acceptation du prix propose: ${input.acceptedAmountLabel} FCFA.`,
      ...(hasCompleteLocalContacts ? input.parcelNotes : []),
      recoveredParcelMessage,
    ];

    return this.joinLimitedNotes(lines);
  }

  extractRequestedServiceName(proposal: NegotiationView | null | undefined): string | null {
    if (!proposal) return null;

    const messages = [
      proposal.messageCourant,
      ...(proposal.propositions ?? []).slice().reverse().map((offer) => offer.message),
    ];

    for (const message of messages) {
      const match = message?.match(/(?:^|\s)Service:\s*(.+?)\.\s*(?:Proposition de prix:|$)/i);
      const serviceName = match?.[1]?.trim().replace(/\s+/g, ' ');
      if (serviceName) return serviceName;
    }

    return null;
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
    const messages = [
      proposal.messageCourant,
      ...(proposal.propositions ?? []).slice().reverse().map((item) => item.message),
    ];
    const message = messages.find((item) => this.hasCompleteParcelContacts(item ?? ''));

    return message?.trim().replace(/\s+/g, ' ') ?? '';
  }

  private hasCompleteParcelContacts(value: string): boolean {
    return (
      /Exp[eé]diteur\s*[:=-]\s*[^.]*[A-Za-zÀ-ÿ][^.]*\s+-\s*\+?\d/i.test(value) &&
      /Destinataire\s*[:=-]\s*[^.]*[A-Za-zÀ-ÿ][^.]*\s+-\s*\+?\d/i.test(value)
    );
  }

  joinLimitedNotes(lines: string[], maxLength = 950): string {
    const text = lines.filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
    if (text.length <= maxLength) {
      return text;
    }

    return `${text.slice(0, maxLength - 3).trim()}...`;
  }
}
