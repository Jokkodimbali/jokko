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

    return input.isProviderProposalMode
      ? 'Le client a annule la negociation'
      : 'Negociation annulee';
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
