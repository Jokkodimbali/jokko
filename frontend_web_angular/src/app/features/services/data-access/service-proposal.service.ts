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

export type MaterialQuoteStatus = 'EN_ATTENTE' | 'VALIDE' | 'REFUSE';

export interface MaterialQuoteView {
  id: string;
  negotiationId: string;
  reservationId: string | null;
  createdByUserId: string;
  createdBy: 'CLIENT' | 'PRESTATAIRE';
  designation: string;
  unitPrice: number;
  quantity: number;
  status: MaterialQuoteStatus;
  clientValidatedAt: string | null;
  providerValidatedAt: string | null;
  rejectedBy: 'CLIENT' | 'PRESTATAIRE' | null;
  pdfUrl: string | null;
  createdAt: string;
  updatedAt: string;
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

export interface CreateMaterialQuotePayload {
  designation: string;
  unitPrice: number;
  quantity: number;
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

export type ProposalReservationStatus =
  | 'CONFIRMEE'
  | 'PAYEE_SEQUESTRE'
  | 'EN_COURS'
  | 'TERMINEE'
  | 'ANNULEE'
  | 'NO_SHOW'
  | 'LITIGE';

export interface ProposalReservationView {
  id: string;
  statut: ProposalReservationStatus;
  raisonAnnulation: string | null;
  misAJourLe: string;
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

  listMaterialQuotes(negotiationId: string): Observable<MaterialQuoteView[]> {
    return this.http
      .get<ApiResponse<MaterialQuoteView[]>>(
        `${this.apiUrl}/negotiations/${negotiationId}/material-quotes`,
      )
      .pipe(map((response) => unwrapApiResponse(response)));
  }

  createMaterialQuote(
    negotiationId: string,
    payload: CreateMaterialQuotePayload,
  ): Observable<MaterialQuoteView> {
    return this.http
      .post<ApiResponse<MaterialQuoteView>>(
        `${this.apiUrl}/negotiations/${negotiationId}/material-quotes`,
        payload,
      )
      .pipe(map((response) => unwrapApiResponse(response)));
  }

  approveMaterialQuote(negotiationId: string, quoteId: string): Observable<MaterialQuoteView> {
    return this.http
      .patch<ApiResponse<MaterialQuoteView>>(
        `${this.apiUrl}/negotiations/${negotiationId}/material-quotes/${quoteId}/approve`,
        {},
      )
      .pipe(map((response) => unwrapApiResponse(response)));
  }

  rejectMaterialQuote(negotiationId: string, quoteId: string): Observable<MaterialQuoteView> {
    return this.http
      .patch<ApiResponse<MaterialQuoteView>>(
        `${this.apiUrl}/negotiations/${negotiationId}/material-quotes/${quoteId}/reject`,
        {},
      )
      .pipe(map((response) => unwrapApiResponse(response)));
  }

  finalizeMaterialQuotes(
    negotiationId: string,
    reservationId: string,
  ): Observable<{ ready: boolean; quoteCount: number; pdfUrl: string | null }> {
    return this.http
      .post<ApiResponse<{ ready: boolean; quoteCount: number; pdfUrl: string | null }>>(
        `${this.apiUrl}/negotiations/${negotiationId}/material-quotes/finalize`,
        { reservationId },
      )
      .pipe(map((response) => unwrapApiResponse(response)));
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

  getReservation(reservationId: string): Observable<ProposalReservationView> {
    return this.http
      .get<ApiResponse<ProposalReservationView>>(`${this.apiUrl}/reservations/${reservationId}`)
      .pipe(map((response) => unwrapApiResponse(response)));
  }

  checkReservationAvailability(input: {
    professionalId: string;
    dateHeure: string;
    dureeMinutes: number;
    pauseMinutes?: number;
  }): Observable<ReservationAvailabilityView> {
    const params: Record<string, string> = {
      professionalId: input.professionalId,
      dateHeure: input.dateHeure,
      dureeMinutes: input.dureeMinutes.toString(),
    };
    if (typeof input.pauseMinutes === 'number') {
      params['pauseMinutes'] = input.pauseMinutes.toString();
    }

    return this.http
      .get<ApiResponse<ReservationAvailabilityView>>(`${this.apiUrl}/reservations/availability`, {
        params,
      })
      .pipe(map((response) => unwrapApiResponse(response)));
  }

  listReservationAvailabilitySlots(input: {
    professionalId: string;
    date: string;
    dureeMinutes: number;
    pauseMinutes?: number;
  }): Observable<ReservationAvailabilitySlotsView> {
    const params: Record<string, string> = {
      professionalId: input.professionalId,
      date: input.date,
      dureeMinutes: input.dureeMinutes.toString(),
    };
    if (typeof input.pauseMinutes === 'number') {
      params['pauseMinutes'] = input.pauseMinutes.toString();
    }

    return this.http
      .get<ApiResponse<ReservationAvailabilitySlotsView>>(
        `${this.apiUrl}/reservations/availability/slots`,
        { params },
      )
      .pipe(map((response) => unwrapApiResponse(response)));
  }

  private clearProposalsCache(): void {
    this.proposalsCache.clear();
  }
}
