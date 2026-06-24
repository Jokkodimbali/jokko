import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, finalize, map, of, shareReplay, tap } from 'rxjs';
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

export type NegotiationScope = 'CLIENT' | 'PRESTATAIRE';

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
  dateHeureProposee: string | null;
  adresseClientProposee: string | null;
  dureeMinutesProposee: number | null;
  reservationId: string | null;
  creeLe: string;
  misAJourLe: string;
  propositions?: Array<{
    id: string;
    proposePar?: 'CLIENT' | 'PRESTATAIRE';
    montant?: number;
    message?: string | null;
    creeLe?: string;
  }>;
  client?: {
    id: string;
    nom: string;
    adresse: string | null;
    urlAvatar: string | null;
  };
  service?: {
    id: string;
    nom: string;
    prix: number;
  };
  professionnel?: {
    id: string;
    utilisateurId: string;
    nomEntreprise: string | null;
    utilisateur: {
      nom: string;
      urlAvatar?: string | null;
    };
  };
}

export interface CreatePriceProposalPayload {
  serviceId: string;
  proposedAmount: number;
  message?: string;
  dateHeure?: string;
  adresseClient?: string;
  dureeMinutes?: number;
}

export interface CreateDirectReservationPayload {
  professionnelId: string;
  serviceId: string;
  dateHeure: string;
  adresseClient: string;
  dureeMinutes: number;
  notes?: string;
}

export interface CreateReservationFromNegotiationPayload {
  negotiationId: string;
  dateHeure: string;
  adresseClient: string;
  dureeMinutes: number;
  notes?: string;
}

export interface ReservationAvailabilityView {
  available: boolean;
  reason: string;
  professionalId: string;
  dateHeure: string;
  dureeMinutes: number;
  withinAvailability: boolean;
  hasConflict: boolean;
}

export interface ReservationAvailabilitySlotView {
  dateHeure: string;
  label: string;
  available: boolean;
  status: 'AVAILABLE' | 'RESERVED' | 'UNAVAILABLE';
  reason: string;
}

export interface ReservationAvailabilitySlotsView {
  professionalId: string;
  date: string;
  dureeMinutes: number;
  slots: ReservationAvailabilitySlotView[];
}

@Injectable({
  providedIn: 'root',
})
export class ServiceProposalService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.apiUrl;
  private readonly proposalsCacheTtlMs = 8000;
  private readonly proposalsCache = new Map<
    NegotiationScope,
    { expiresAt: number; value: NegotiationView[] }
  >();
  private readonly proposalsInFlight = new Map<NegotiationScope, Observable<NegotiationView[]>>();
  private readonly editableStatuses = new Set<NegotiationStatus>([
    'EN_ATTENTE_PRESTATAIRE',
    'EN_ATTENTE_CLIENT',
  ]);

  listMyPriceProposals(
    scope: NegotiationScope = 'CLIENT',
    forceRefresh = false,
  ): Observable<NegotiationView[]> {
    if (forceRefresh) {
      this.proposalsCache.delete(scope);
    }

    const cached = this.proposalsCache.get(scope);
    if (cached && cached.expiresAt > Date.now()) {
      return of(cached.value);
    }

    const inFlight = this.proposalsInFlight.get(scope);
    if (inFlight) {
      return inFlight;
    }

    const request$ = this.http
      .get<ApiResponse<NegotiationView[]>>(`${this.apiUrl}/negotiations/my`, {
        params: {
          scope,
          limit: '100',
          offset: '0',
        },
      })
      .pipe(
        map((response) => unwrapApiResponse(response)),
        tap((value) =>
          this.proposalsCache.set(scope, {
            value,
            expiresAt: Date.now() + this.proposalsCacheTtlMs,
          }),
        ),
        finalize(() => this.proposalsInFlight.delete(scope)),
        shareReplay({ bufferSize: 1, refCount: false }),
      );

    this.proposalsInFlight.set(scope, request$);
    return request$;
  }

  findActiveProposalForService(serviceId: string): Observable<NegotiationView | null> {
    return this.listMyPriceProposals().pipe(
      map(
        (proposals) =>
          proposals.find(
            (proposal) =>
              proposal.serviceId === serviceId && this.editableStatuses.has(proposal.statut),
          ) ?? null,
      ),
    );
  }

  createPriceProposal(payload: CreatePriceProposalPayload): Observable<NegotiationView> {
    return this.http
      .post<ApiResponse<NegotiationView>>(`${this.apiUrl}/negotiations`, payload)
      .pipe(
        map((response) => unwrapApiResponse(response)),
        tap(() => this.clearProposalsCache()),
      );
  }

  getPriceProposal(negotiationId: string): Observable<NegotiationView> {
    return this.http
      .get<ApiResponse<NegotiationView>>(`${this.apiUrl}/negotiations/${negotiationId}`)
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
          dateHeure: payload.dateHeure,
          adresseClient: payload.adresseClient,
          dureeMinutes: payload.dureeMinutes,
        },
      )
      .pipe(
        map((response) => unwrapApiResponse(response)),
        tap(() => this.clearProposalsCache()),
      );
  }

  acceptPriceProposal(negotiationId: string): Observable<NegotiationView> {
    return this.http
      .patch<ApiResponse<NegotiationView>>(`${this.apiUrl}/negotiations/${negotiationId}/accept`, {})
      .pipe(
        map((response) => unwrapApiResponse(response)),
        tap(() => this.clearProposalsCache()),
      );
  }

  rejectPriceProposal(negotiationId: string, reason: string): Observable<NegotiationView> {
    return this.http
      .patch<ApiResponse<NegotiationView>>(`${this.apiUrl}/negotiations/${negotiationId}/reject`, {
        reason,
      })
      .pipe(
        map((response) => unwrapApiResponse(response)),
        tap(() => this.clearProposalsCache()),
      );
  }

  cancelPriceProposal(negotiationId: string, reason?: string): Observable<NegotiationView> {
    return this.http
      .patch<ApiResponse<NegotiationView>>(`${this.apiUrl}/negotiations/${negotiationId}/cancel`, {
        reason,
      })
      .pipe(
        map((response) => unwrapApiResponse(response)),
        tap(() => this.clearProposalsCache()),
      );
  }

  createDirectReservation(payload: CreateDirectReservationPayload): Observable<{ id?: string }> {
    return this.http
      .post<ApiResponse<{ id?: string }>>(`${this.apiUrl}/reservations`, payload)
      .pipe(map((response) => unwrapApiResponse(response)));
  }

  createReservationFromNegotiation(
    payload: CreateReservationFromNegotiationPayload,
  ): Observable<{ id: string }> {
    return this.http
      .post<ApiResponse<{ id: string }>>(`${this.apiUrl}/reservations/from-negotiation`, payload)
      .pipe(
        map((response) => unwrapApiResponse(response)),
        tap(() => this.clearProposalsCache()),
      );
  }

  checkReservationAvailability(input: {
    professionalId: string;
    dateHeure: string;
    dureeMinutes: number;
  }): Observable<ReservationAvailabilityView> {
    return this.http
      .get<ApiResponse<ReservationAvailabilityView>>(`${this.apiUrl}/reservations/availability`, {
        params: {
          professionalId: input.professionalId,
          dateHeure: input.dateHeure,
          dureeMinutes: input.dureeMinutes.toString(),
        },
      })
      .pipe(map((response) => unwrapApiResponse(response)));
  }

  listReservationAvailabilitySlots(input: {
    professionalId: string;
    date: string;
    dureeMinutes: number;
  }): Observable<ReservationAvailabilitySlotsView> {
    return this.http
      .get<ApiResponse<ReservationAvailabilitySlotsView>>(
        `${this.apiUrl}/reservations/availability/slots`,
        {
          params: {
            professionalId: input.professionalId,
            date: input.date,
            dureeMinutes: input.dureeMinutes.toString(),
          },
        },
      )
      .pipe(map((response) => unwrapApiResponse(response)));
  }

  private clearProposalsCache(): void {
    this.proposalsCache.clear();
  }
}
