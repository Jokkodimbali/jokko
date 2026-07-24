import { Injectable } from '@angular/core';
import { negotiationStatusLabel } from '../../../../../shared/utils/jokko-status-labels';
import { NegotiationView } from '../../../data-access/service-proposal.service';
import { BackendProfessionalDetailService } from '../../../domain/models/services.models';
import { ServiceProposalFormatService } from './service-proposal-format.service';

@Injectable({ providedIn: 'root' })
export class ServiceProposalPricingViewService {
  constructor(private readonly formatter: ServiceProposalFormatService) {}

  providerProposalStatusLabel(status: NegotiationView['statut'] | undefined): string {
    return negotiationStatusLabel(status);
  }

  providerBaseOfferAmount(input: {
    proposal: NegotiationView | null;
    currentService: BackendProfessionalDetailService | null;
    fairServiceAmount: number;
  }): number {
    if (!input.proposal) return input.fairServiceAmount;

    const lastProviderProposal = [...(input.proposal.propositions ?? [])]
      .reverse()
      .find((item) => item.proposePar === 'PRESTATAIRE' && Number.isFinite(Number(item.montant)));

    return Math.trunc(
      Number(
        lastProviderProposal?.montant ??
          input.proposal.service?.prix ??
          input.currentService?.prix ??
          input.proposal.montantInitial,
      ),
    );
  }

  providerCounterDifferenceLabel(base: number, offerAmount: number): string {
    const amount = Math.trunc(Number(offerAmount));
    if (!base || !Number.isFinite(amount) || amount <= 0) {
      return 'Montant a confirmer avec le client';
    }

    const difference = Math.abs(amount - base);
    if (difference === 0) return 'Votre contre-offre correspond a votre offre';

    const direction = amount < base ? 'moins cher que votre offre' : 'plus cher que votre offre';
    return `${this.formatAmount(difference)} FCFA ${direction}`;
  }

  providerCounterActionLabel(proposal: NegotiationView | null, offerAmount: number): string {
    if (!proposal) return "Accepter l'offre";
    return Math.trunc(Number(offerAmount)) === Math.trunc(Number(proposal.montantCourant))
      ? "Accepter l'offre"
      : 'Proposer au client';
  }

  providerSummaryPriceLabel(proposal: NegotiationView | null): string {
    return proposal?.statut === 'EN_ATTENTE_CLIENT'
      ? 'PRIX EQUITABLE MIS A JOUR'
      : 'PRIX EQUITABLE DU SERVICE';
  }

  offerDifferenceLabel(input: {
    servicePrice: number;
    offerAmount: number;
    hasCustomServiceName: boolean;
  }): string {
    const servicePrice = Number(input.servicePrice);
    const offer = Number(input.offerAmount);

    if (!Number.isFinite(servicePrice) || servicePrice <= 0 || !Number.isFinite(offer) || offer <= 0) {
      return input.hasCustomServiceName
        ? 'Definissez le prix que vous souhaitez proposer au prestataire.'
        : 'Montant a confirmer avec le prestataire';
    }

    const difference = Math.trunc(Math.abs(offer - servicePrice));
    if (difference === 0) {
      return 'Votre offre correspond au prix initial du service';
    }

    const direction =
      offer < servicePrice
        ? "moins cher que l'offre du prestataire"
        : "plus que l'offre du prestataire";
    return `${this.formatAmount(difference)} FCFA ${direction}`;
  }

  offerDifferenceIcon(servicePrice: number, offerAmount: number): 'check' | 'arrow-down' | 'arrow-up-right' {
    if (!servicePrice || !offerAmount || servicePrice === offerAmount) {
      return 'check';
    }

    return offerAmount < servicePrice ? 'arrow-down' : 'arrow-up-right';
  }

  offerEquityLabel(input: { hasCustomServiceName: boolean; isFixedPriceService: boolean }): string {
    if (input.hasCustomServiceName) {
      return 'Definissez le prix que vous souhaitez proposer au prestataire.';
    }

    return input.isFixedPriceService
      ? 'Tarif du prestataire.'
      : 'Offre equitable pour le prestataire.';
  }

  counterDifferenceLabel(proposal: NegotiationView | null): string {
    if (!proposal) return '';
    const clientOffer = this.latestNegotiationOffer(proposal, 'CLIENT') ?? proposal.montantInitial;
    const difference = Math.trunc(proposal.montantCourant - clientOffer);
    if (difference === 0) return 'La proposition correspond a votre offre';

    const direction = difference > 0 ? 'de plus que votre offre' : 'de moins que votre offre';
    return `${this.formatAmount(Math.abs(difference))} FCFA ${direction}`;
  }

  counterActionLabel(proposal: NegotiationView | null, offerAmount: number): string {
    if (!proposal) return "valider l'offre";
    return offerAmount === proposal.montantCourant ? "valider l'offre" : 'Envoyer ma contre-offre';
  }

  acceptedComparisonLabel(servicePrice: number | null, acceptedAmount: number | null): string {
    if (!servicePrice) return 'Prix initial';
    if (!acceptedAmount || servicePrice === acceptedAmount) return 'Difference';
    return acceptedAmount < servicePrice ? 'Economie' : 'Ajustement';
  }

  acceptedComparisonAmountLabel(servicePrice: number | null, acceptedAmount: number | null): string {
    if (!servicePrice) return 'A confirmer';
    if (!acceptedAmount || servicePrice === acceptedAmount) return '0 FCFA';

    const difference = Math.abs(servicePrice - acceptedAmount);
    return `+${this.formatAmount(difference)} FCFA`;
  }

  private formatAmount(value: number): string {
    return this.formatter.formatAmount(value);
  }

  private latestNegotiationOffer(
    negotiation: NegotiationView,
    actor: 'CLIENT' | 'PRESTATAIRE',
  ): number | null {
    const offer = [...(negotiation.propositions ?? [])]
      .reverse()
      .find((item) => item.proposePar === actor);
    const amount = Number(offer?.montant);
    return Number.isFinite(amount) && amount > 0 ? amount : null;
  }
}
