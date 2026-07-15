import { Injectable } from '@angular/core';
import { NegotiationView } from '../../../data-access/service-proposal.service';
import { BackendProfessionalDetailService } from '../../../domain/models/services.models';

@Injectable({ providedIn: 'root' })
export class ServiceProposalStateService {
  isNegotiationClosed(proposal: NegotiationView | null): boolean {
    return proposal?.statut === 'ANNULEE' || proposal?.statut === 'REFUSEE';
  }

  shouldStopProposalRefresh(proposal: NegotiationView): boolean {
    return proposal.statut === 'REFUSEE' || proposal.statut === 'ANNULEE';
  }

  closedNegotiationTitle(input: {
    proposal: NegotiationView;
    isLinkedReservationCancelled: boolean;
    isProviderProposalMode: boolean;
  }): string {
    if (input.isLinkedReservationCancelled) {
      return input.isProviderProposalMode
        ? 'Le client a annule la reservation'
        : 'Reservation annulee';
    }

    if (input.proposal.statut === 'ANNULEE') {
      return input.isProviderProposalMode
        ? 'Le client a annule la negociation'
        : 'Negociation annulee';
    }

    return input.isProviderProposalMode
      ? 'Negociation refusee'
      : 'Le prestataire a refuse la negociation';
  }

  closedNegotiationMessage(input: {
    proposal: NegotiationView;
    serviceName: string;
    isLinkedReservationCancelled: boolean;
    cancellationReason: string | null;
    isProviderProposalMode: boolean;
    proposalClientName: string;
    providerName: string;
  }): string {
    if (input.isLinkedReservationCancelled) {
      const reason = input.cancellationReason;
      return input.isProviderProposalMode
        ? `${input.proposalClientName} a annule la reservation pour ${input.serviceName} avant le paiement.${reason ? ` Motif : ${reason}` : ''}`
        : `Cette reservation pour ${input.serviceName} a ete annulee avant paiement.${reason ? ` Motif : ${reason}` : ''}`;
    }

    if (input.proposal.statut === 'ANNULEE') {
      return input.isProviderProposalMode
        ? `${input.proposalClientName} a annule la negociation pour ${input.serviceName}. Vous pouvez quitter cet ecran.`
        : `Cette negociation pour ${input.serviceName} est annulee. Vous pouvez choisir un autre prestataire ou quitter cet ecran.`;
    }

    return input.isProviderProposalMode
      ? `Vous avez refuse cette negociation pour ${input.serviceName}.`
      : `${input.providerName} a refuse la negociation pour ${input.serviceName}. Vous pouvez quitter cet ecran.`;
  }

  isValidAppointmentDate(value: string): boolean {
    const selectedDate = new Date(value);
    if (Number.isNaN(selectedDate.getTime())) {
      return false;
    }

    return selectedDate.getTime() > Date.now();
  }

  serviceDurationMinutes(service: BackendProfessionalDetailService | null): number {
    const duration = Math.trunc(Number(service?.dureeMinutes));
    return Number.isInteger(duration) && duration >= 5 && duration <= 1440 ? duration : 60;
  }

  servicePauseMinutes(service: BackendProfessionalDetailService | null): number {
    const pause = Math.trunc(Number(service?.pauseMinutes ?? 0));
    return Number.isInteger(pause) && pause >= 0 && pause <= 240 ? pause : 0;
  }
}
