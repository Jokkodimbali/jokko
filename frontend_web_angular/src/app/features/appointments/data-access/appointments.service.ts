import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, forkJoin, map, of, switchMap } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { publicAssetUrl } from '../../../shared/utils/public-asset-url';
import { ApiResponse } from '../../../core/http/api-response.models';
import { unwrapApiResponse } from '../../../core/http/api-response.utils';
import { ServicesService } from '../../services/data-access/services.service';
import {
  GoogleMapsCoordinate,
  GoogleMapsGeocodeResult,
  GoogleMapsRouteResult,
} from '../../../shared/maps/google-maps-loader.service';
import {
  AppointmentView,
  AppointmentTrackingView,
  BackendReservation,
  PaymentInitiationView,
  PaymentMethod,
  ReservationDisputeView,
} from '../domain/appointments.models';

@Injectable({
  providedIn: 'root',
})
export class AppointmentsService {
  private readonly http = inject(HttpClient);
  private readonly servicesService = inject(ServicesService);
  private readonly apiUrl = environment.apiUrl;

  listMyAppointments(scope: 'CLIENT' | 'PRESTATAIRE' = 'CLIENT'): Observable<AppointmentView[]> {
    return this.http
      .get<ApiResponse<BackendReservation[]>>(`${this.apiUrl}/reservations/my`, {
        params: { scope },
      })
      .pipe(
        map(unwrapApiResponse),
        switchMap((reservations) => {
          if (reservations.length === 0) return of([]);

          return forkJoin(
            reservations.map((reservation) => {
              const enriched = this.mapFromEnrichedReservation(reservation);
              if (enriched) return of(enriched);

              return this.servicesService.getProviderProfileDetail(reservation.professionnelId).pipe(
                map((detail) => {
                  const service =
                    detail.services.find((item) => item.id === reservation.serviceId) ??
                    detail.services[0];

                  return this.mapAppointment(reservation, {
                    doctorName:
                      detail.profile.nomEntreprise ||
                      detail.profile.utilisateur.nom ||
                      'Prestataire non renseigne',
                    specialty: service?.nom || 'Service non renseigne',
                    avatarUrl: detail.profile.utilisateur.urlAvatar || '',
                    professionalPhone: detail.profile.utilisateur.numeroTelephone || null,
                    professionalRating: detail.profile.noteGlobale ?? null,
                    professionalReviews: detail.profile.nombreAvis ?? 0,
                    serviceName: service?.nom || 'Service non renseigne',
                    serviceDescription: service?.description || null,
                    servicePrice: service?.prix ?? null,
                    travelMode: service?.modeDeplacement ?? null,
                  });
                }),
                catchError(() => of(this.mapAppointment(reservation))),
              );
            }),
          );
        }),
        catchError(() => of([])),
      );
  }

  getAppointmentById(reservationId: string): Observable<AppointmentView> {
    return this.http
      .get<ApiResponse<BackendReservation>>(`${this.apiUrl}/reservations/${reservationId}`)
      .pipe(
        map(unwrapApiResponse),
        switchMap((reservation) => {
          const enriched = this.mapFromEnrichedReservation(reservation);
          if (enriched) return of(enriched);

          return this.servicesService.getProviderProfileDetail(reservation.professionnelId).pipe(
            map((detail) => {
              const service =
                detail.services.find((item) => item.id === reservation.serviceId) ??
                detail.services[0];

              return this.mapAppointment(reservation, {
                doctorName:
                  detail.profile.nomEntreprise ||
                  detail.profile.utilisateur.nom ||
                  'Prestataire non renseigne',
                specialty: service?.nom || 'Service non renseigne',
                avatarUrl: detail.profile.utilisateur.urlAvatar || '',
                professionalPhone: detail.profile.utilisateur.numeroTelephone || null,
                professionalRating: detail.profile.noteGlobale ?? null,
                professionalReviews: detail.profile.nombreAvis ?? 0,
                serviceName: service?.nom || 'Service non renseigne',
                serviceDescription: service?.description || null,
                servicePrice: service?.prix ?? null,
                travelMode: service?.modeDeplacement ?? null,
              });
            }),
            catchError(() => of(this.mapAppointment(reservation))),
          );
        }),
      );
  }

  getAppointmentTracking(reservationId: string): Observable<AppointmentTrackingView> {
    return this.http
      .get<ApiResponse<AppointmentTrackingView>>(
        `${this.apiUrl}/reservations/${reservationId}/live-tracking`,
      )
      .pipe(map(unwrapApiResponse));
  }

  geocodeAddress(address: string): Observable<GoogleMapsGeocodeResult | null> {
    return this.http
      .get<ApiResponse<GoogleMapsGeocodeResult | null>>(`${this.apiUrl}/maps/geocode`, {
        params: { address },
      })
      .pipe(map(unwrapApiResponse));
  }

  computeRoutes(input: {
    origin: GoogleMapsCoordinate;
    destination: GoogleMapsCoordinate;
  }): Observable<GoogleMapsRouteResult[]> {
    return this.http
      .post<ApiResponse<GoogleMapsRouteResult[]>>(`${this.apiUrl}/maps/routes`, input)
      .pipe(map(unwrapApiResponse));
  }

  markAppointmentAsPaid(reservationId: string): Observable<AppointmentView> {
    return this.http
      .patch<ApiResponse<BackendReservation>>(
        `${this.apiUrl}/reservations/${reservationId}/mark-paid`,
        {},
      )
      .pipe(map(unwrapApiResponse), map((reservation) => this.mapAppointment(reservation)));
  }

  confirmAppointment(reservationId: string): Observable<AppointmentView> {
    return this.http
      .patch<ApiResponse<BackendReservation>>(
        `${this.apiUrl}/reservations/${reservationId}/confirm`,
        {},
      )
      .pipe(map(unwrapApiResponse), map((reservation) => this.mapAppointment(reservation)));
  }

  rescheduleAppointment(
    reservationId: string,
    data: {
      newDateTime: string;
    },
  ): Observable<AppointmentView> {
    return this.http
      .patch<ApiResponse<BackendReservation>>(
        `${this.apiUrl}/reservations/${reservationId}/reschedule`,
        data,
      )
      .pipe(map(unwrapApiResponse), map((reservation) => this.mapAppointment(reservation)));
  }

  openDispute(reservationId: string, reason: string): Observable<AppointmentView> {
    return this.http
      .patch<ApiResponse<BackendReservation>>(`${this.apiUrl}/reservations/${reservationId}/dispute`, {
        reason,
      })
      .pipe(map(unwrapApiResponse), map((reservation) => this.mapAppointment(reservation)));
  }

  uploadDisputeEvidence(reservationId: string, files: File[]): Observable<unknown[]> {
    const formData = new FormData();
    files.forEach((file) => formData.append('evidence', file));

    return this.http
      .post<ApiResponse<unknown[]>>(
        `${this.apiUrl}/reservations/${reservationId}/dispute/evidence`,
        formData,
      )
      .pipe(map(unwrapApiResponse));
  }

  deleteDisputeEvidence(reservationId: string, evidenceId: string): Observable<unknown[]> {
    return this.http
      .delete<ApiResponse<unknown[]>>(
        `${this.apiUrl}/reservations/${reservationId}/dispute/evidence/${evidenceId}`
      )
      .pipe(map(unwrapApiResponse));
  }

  getReservationDispute(reservationId: string): Observable<ReservationDisputeView> {
    return this.http
      .get<ApiResponse<ReservationDisputeView>>(
        `${this.apiUrl}/reservations/${reservationId}/dispute`,
      )
      .pipe(map(unwrapApiResponse));
  }

  markProviderOnTheWay(
    reservationId: string,
    location: {
      latitude?: number;
      longitude?: number;
      accuracyMeters?: number | null;
      headingDegrees?: number | null;
      speedKmh?: number | null;
      locationLabel?: string | null;
    },
  ): Observable<AppointmentTrackingView> {
    return this.http
      .patch<ApiResponse<AppointmentTrackingView>>(
        `${this.apiUrl}/reservations/${reservationId}/on-the-way`,
        location,
      )
      .pipe(map(unwrapApiResponse));
  }

  updateProviderTrackingLocation(
    reservationId: string,
    location: {
      latitude: number;
      longitude: number;
      accuracyMeters?: number | null;
      headingDegrees?: number | null;
      speedKmh?: number | null;
      locationLabel?: string | null;
    },
  ): Observable<AppointmentTrackingView> {
    return this.http
      .patch<ApiResponse<AppointmentTrackingView>>(
        `${this.apiUrl}/reservations/${reservationId}/live-tracking/location`,
        location,
      )
      .pipe(map(unwrapApiResponse));
  }

  startAppointment(reservationId: string): Observable<AppointmentView> {
    return this.http
      .patch<ApiResponse<BackendReservation>>(
        `${this.apiUrl}/reservations/${reservationId}/start`,
        {},
      )
      .pipe(map(unwrapApiResponse), map((reservation) => this.mapAppointment(reservation)));
  }

  completeAppointment(reservationId: string): Observable<AppointmentView> {
    return this.http
      .patch<ApiResponse<BackendReservation>>(
        `${this.apiUrl}/reservations/${reservationId}/complete`,
        {},
      )
      .pipe(map(unwrapApiResponse), map((reservation) => this.mapAppointment(reservation)));
  }

  initiatePayment(
    reservationId: string,
    method: PaymentMethod,
    options?: { successPath?: string; cancelPath?: string },
  ): Observable<PaymentInitiationView> {
    return this.http
      .post<ApiResponse<PaymentInitiationView>>(
        `${this.apiUrl}/payments/initiate`,
        {
          bookingId: reservationId,
          method,
          successUrl: this.absoluteUrl(options?.successPath ?? `/appointments/${reservationId}`),
          cancelUrl: this.absoluteUrl(options?.cancelPath ?? `/appointments/${reservationId}/payment`),
        },
        {
          headers: {
            'Idempotency-Key': `web-payment-${reservationId}-${method}-${Date.now()}`,
          },
        },
      )
      .pipe(map(unwrapApiResponse));
  }

  cancelAppointment(
    reservationId: string,
    reason = 'Annulation demandee depuis l espace rendez-vous.',
  ): Observable<AppointmentView> {
    return this.http
      .patch<ApiResponse<BackendReservation>>(`${this.apiUrl}/reservations/${reservationId}/cancel`, {
        reason,
      })
      .pipe(map(unwrapApiResponse), map((reservation) => this.mapAppointment(reservation)));
  }

  acceptPriceAdjustment(reservationId: string): Observable<AppointmentView> {
    return this.http
      .patch<ApiResponse<BackendReservation>>(
        `${this.apiUrl}/reservations/${reservationId}/price-adjustment/accept`,
        {},
      )
      .pipe(map(unwrapApiResponse), map((reservation) => this.mapAppointment(reservation)));
  }

  rejectPriceAdjustment(reservationId: string): Observable<AppointmentView> {
    return this.http
      .patch<ApiResponse<BackendReservation>>(
        `${this.apiUrl}/reservations/${reservationId}/price-adjustment/reject`,
        {},
      )
      .pipe(map(unwrapApiResponse), map((reservation) => this.mapAppointment(reservation)));
  }

  proposePriceAdjustment(
    reservationId: string,
    data: {
      proposedPrice: number;
      reason: string;
    },
  ): Observable<AppointmentView> {
    return this.http
      .patch<ApiResponse<BackendReservation>>(
        `${this.apiUrl}/reservations/${reservationId}/price-adjustment/propose`,
        data,
      )
      .pipe(map(unwrapApiResponse), map((reservation) => this.mapAppointment(reservation)));
  }

  markNoShow(reservationId: string): Observable<AppointmentView> {
    return this.http
      .patch<ApiResponse<BackendReservation>>(`${this.apiUrl}/reservations/${reservationId}/no-show`, {})
      .pipe(map(unwrapApiResponse), map((reservation) => this.mapAppointment(reservation)));
  }

  submitReview(reservationId: string, rating: number, review?: string): Observable<AppointmentView> {
    return this.http
      .patch<ApiResponse<BackendReservation>>(
        `${this.apiUrl}/reservations/${reservationId}/review`,
        { rating, review },
      )
      .pipe(map(unwrapApiResponse), map((reservation) => this.mapAppointment(reservation)));
  }

  private mapAppointment(
    reservation: BackendReservation,
    professional: {
      doctorName?: string;
      specialty?: string;
      avatarUrl?: string;
      professionalPhone?: string | null;
      professionalRating?: number | null;
      professionalReviews?: number;
      serviceName?: string;
      serviceDescription?: string | null;
      servicePrice?: number | null;
      travelMode?: AppointmentView['travelMode'];
    } = {},
  ): AppointmentView {
    const date = new Date(reservation.dateHeure);

    return {
      id: reservation.id,
      professionalId: reservation.professionnelId,
      serviceId: reservation.serviceId,
      status: reservation.statut,
      scheduledAt: reservation.dateHeure,
      durationMinutes: reservation.dureeMinutes,
      eyebrow: this.isDone(reservation.statut) ? 'RENDEZ-VOUS TERMINE' : 'PROCHAIN RENDEZ-VOUS',
      dateLabel: this.formatDate(date),
      shortDateLabel: this.formatShortDate(date),
      fullDateLabel: this.formatFullDate(date),
      timeLabel: this.formatTime(date),
      locationLabel: reservation.adresseClient || 'Adresse non renseignee',
      doctorName: professional.doctorName || 'Prestataire non renseigne',
      specialty: professional.specialty || reservation.service?.nom || 'Service non renseigne',
      avatarUrl: publicAssetUrl(professional.avatarUrl) || '',
      professionalPhone:
        professional.professionalPhone ?? reservation.professionnel?.utilisateur.numeroTelephone ?? null,
      professionalRating:
        professional.professionalRating ?? reservation.professionnel?.noteGlobale ?? null,
      professionalReviews:
        professional.professionalReviews ?? reservation.professionnel?.nombreAvis ?? 0,
      clientName: reservation.client?.nom || 'Client non renseigne',
      clientPhone: reservation.client?.numeroTelephone || null,
      clientAvatarUrl: publicAssetUrl(reservation.client?.urlAvatar) || '',
      serviceName: professional.serviceName || reservation.service?.nom || 'Service non renseigne',
      serviceDescription: professional.serviceDescription ?? reservation.service?.description ?? null,
      servicePrice: professional.servicePrice ?? reservation.service?.prix ?? null,
      travelMode: professional.travelMode ?? reservation.service?.modeDeplacement ?? null,
      notes: reservation.notes,
      agreedPrice: reservation.prixConvenu,
      priceAdjustmentStatus: reservation.statutAjustementPrix || 'AUCUN',
      proposedAdjustedPrice: reservation.prixAjustementPropose,
      priceAdjustmentReason: reservation.raisonAjustementPrix,
      priceAdjustmentRequestedAt: reservation.demandeAjustementPrixLe,
      clientRating: reservation.clientRating,
      clientReview: reservation.clientReview,
      clientReviewedAt: reservation.clientReviewedAt,
      confirmationLabel: this.confirmationLabel(reservation.statut),
      addressLabel: reservation.adresseClient || 'Adresse non renseignee',
    };
  }

  private isDone(status: BackendReservation['statut']): boolean {
    return status === 'TERMINEE' || status === 'ANNULEE' || status === 'NO_SHOW';
  }

  private confirmationLabel(status: BackendReservation['statut']): string {
    const labels: Record<BackendReservation['statut'], string> = {
      EN_ATTENTE: 'Paiement ou validation en attente',
      CONFIRMEE: 'Votre intervention est confirmee, paiement a finaliser',
      PAYEE_SEQUESTRE: 'Votre intervention est confirmee',
      EN_COURS: 'Votre rendez-vous est en cours',
      TERMINEE: 'Votre rendez-vous est termine',
      ANNULEE: 'Votre rendez-vous est annule',
      NO_SHOW: 'Rendez-vous marque absent',
      LITIGE: 'Votre rendez-vous est en litige',
    };

    return labels[status];
  }

  private formatDate(date: Date): string {
    if (Number.isNaN(date.getTime())) return 'Date a confirmer';

    return new Intl.DateTimeFormat('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    }).format(date);
  }

  private mapFromEnrichedReservation(reservation: BackendReservation): AppointmentView | null {
    if (!reservation.service || !reservation.professionnel) return null;

    return this.mapAppointment(reservation, {
      doctorName:
        reservation.professionnel.nomEntreprise ||
        reservation.professionnel.utilisateur.nom ||
        'Prestataire non renseigne',
      specialty: reservation.service.nom,
      avatarUrl: reservation.professionnel.utilisateur.urlAvatar || '',
      professionalPhone: reservation.professionnel.utilisateur.numeroTelephone || null,
      professionalRating: reservation.professionnel.noteGlobale,
      professionalReviews: reservation.professionnel.nombreAvis,
      serviceName: reservation.service.nom,
      serviceDescription: reservation.service.description,
      travelMode: reservation.service.modeDeplacement,
    });
  }

  private formatShortDate(date: Date): string {
    if (Number.isNaN(date.getTime())) return '--/--/--';

    return new Intl.DateTimeFormat('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
    }).format(date);
  }

  private formatFullDate(date: Date): string {
    if (Number.isNaN(date.getTime())) return 'date a confirmer';

    return new Intl.DateTimeFormat('fr-FR', {
      day: 'numeric',
      month: 'long',
    }).format(date);
  }

  private formatTime(date: Date): string {
    if (Number.isNaN(date.getTime())) return '--h--';

    return new Intl.DateTimeFormat('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
    }).format(date).replace(':', 'h');
  }

  private absoluteUrl(path: string): string {
    if (typeof window === 'undefined') {
      return path;
    }

    return `${window.location.origin}${path}`;
  }
}
