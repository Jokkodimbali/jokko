import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { ApiResponse } from '../../../core/http/api-response.models';
import { unwrapApiResponse } from '../../../core/http/api-response.utils';

export type NegotiationStatus =
  | 'EN_ATTENTE_PRESTATAIRE'
  | 'EN_ATTENTE_CLIENT'
  | 'ACCEPTEE'
  | 'REFUSEE'
  | 'ANNULEE'
  | 'CONVERTIE_EN_RESERVATION';

export interface NegotiationView {
  id: string;
  clientId: string;
  professionnelId: string;
  serviceId: string;
  statut: NegotiationStatus;
  montantInitial: number;
  montantCourant: number;
  montantAccepte: number | null;
  dernierProposePar: 'CLIENT' | 'PRESTATAIRE';
  messageCourant: string | null;
  reservationId: string | null;
  creeLe: string;
  misAJourLe: string;
  propositions?: Array<{ id: string }>;
}

export interface CreatePriceProposalPayload {
  serviceId: string;
  proposedAmount: number;
  message?: string;
}

export interface CreateDirectReservationPayload {
  professionnelId: string;
  serviceId: string;
  dateHeure: string;
  adresseClient: string;
  dureeMinutes: number;
  notes?: string;
}

@Injectable({
  providedIn: 'root',
})
export class ServiceProposalService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.apiUrl;
  private readonly activeStatuses = new Set<NegotiationStatus>([
    'EN_ATTENTE_PRESTATAIRE',
    'EN_ATTENTE_CLIENT',
    'ACCEPTEE',
  ]);

  listMyPriceProposals(): Observable<NegotiationView[]> {
    return this.http
      .get<ApiResponse<NegotiationView[]>>(`${this.apiUrl}/negotiations/my`, {
        params: {
          scope: 'CLIENT',
          limit: '100',
          offset: '0',
        },
      })
      .pipe(map((response) => unwrapApiResponse(response)));
  }

  findActiveProposalForService(serviceId: string): Observable<NegotiationView | null> {
    return this.listMyPriceProposals().pipe(
      map(
        (proposals) =>
          proposals.find(
            (proposal) =>
              proposal.serviceId === serviceId && this.activeStatuses.has(proposal.statut),
          ) ?? null,
      ),
    );
  }

  createPriceProposal(payload: CreatePriceProposalPayload): Observable<NegotiationView> {
    return this.http
      .post<ApiResponse<NegotiationView>>(`${this.apiUrl}/negotiations`, payload)
      .pipe(map((response) => unwrapApiResponse(response)));
  }

  counterPriceProposal(
    negotiationId: string,
    payload: CreatePriceProposalPayload,
  ): Observable<NegotiationView> {
    return this.http
      .patch<ApiResponse<NegotiationView>>(
        `${this.apiUrl}/negotiations/${negotiationId}/counter`,
        {
          proposedAmount: payload.proposedAmount,
          message: payload.message,
        },
      )
      .pipe(map((response) => unwrapApiResponse(response)));
  }

  createDirectReservation(payload: CreateDirectReservationPayload): Observable<unknown> {
    return this.http
      .post<ApiResponse<unknown>>(`${this.apiUrl}/reservations`, payload)
      .pipe(map((response) => unwrapApiResponse(response)));
  }
}
