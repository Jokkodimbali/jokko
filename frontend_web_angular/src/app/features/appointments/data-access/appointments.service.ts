import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, forkJoin, map, of, switchMap } from 'rxjs';
import { environment } from '../../../../environments/environment';
import { ApiResponse } from '../../../core/http/api-response.models';
import { unwrapApiResponse } from '../../../core/http/api-response.utils';
import { ServicesService } from '../../services/data-access/services.service';
import { BackendReservation, AppointmentView } from '../domain/appointments.models';

@Injectable({
  providedIn: 'root',
})
export class AppointmentsService {
  private readonly http = inject(HttpClient);
  private readonly servicesService = inject(ServicesService);
  private readonly apiUrl = environment.apiUrl;

  listMyAppointments(): Observable<AppointmentView[]> {
    return this.http
      .get<ApiResponse<BackendReservation[]>>(`${this.apiUrl}/reservations/my`)
      .pipe(
        map(unwrapApiResponse),
        switchMap((reservations) => {
          if (reservations.length === 0) return of([]);

          return forkJoin(
            reservations.map((reservation) =>
              this.servicesService.getProviderProfileDetail(reservation.professionnelId).pipe(
                map((detail) => {
                  const service =
                    detail.services.find((item) => item.id === reservation.serviceId) ??
                    detail.services[0];

                  return this.mapAppointment(reservation, {
                    doctorName:
                      detail.profile.nomEntreprise ||
                      detail.profile.utilisateur.nom ||
                      'Professionnel Jokko',
                    specialty: service?.nom || 'Consultation',
                    avatarUrl: detail.profile.utilisateur.urlAvatar || '/medicine-doctor-charle-diouf.png',
                    serviceName: service?.nom || 'Service Jokko',
                  });
                }),
                catchError(() => of(this.mapAppointment(reservation))),
              ),
            ),
          );
        }),
        catchError(() => of([])),
      );
  }

  private mapAppointment(
    reservation: BackendReservation,
    professional: {
      doctorName?: string;
      specialty?: string;
      avatarUrl?: string;
      serviceName?: string;
    } = {},
  ): AppointmentView {
    const date = new Date(reservation.dateHeure);

    return {
      id: reservation.id,
      status: reservation.statut,
      scheduledAt: reservation.dateHeure,
      eyebrow: this.isDone(reservation.statut) ? 'RENDEZ-VOUS TERMINE' : 'PROCHAIN RENDEZ-VOUS',
      dateLabel: this.formatDate(date),
      timeLabel: this.formatTime(date),
      locationLabel: reservation.adresseClient || 'Au cabinet',
      doctorName: professional.doctorName || 'Professionnel Jokko',
      specialty: professional.specialty || 'Consultation',
      avatarUrl: professional.avatarUrl || '/medicine-doctor-charle-diouf.png',
      serviceName: professional.serviceName || 'Consultation',
      confirmationLabel: this.confirmationLabel(reservation.statut),
      addressLabel: reservation.adresseClient || 'Adresse non renseignee',
    };
  }

  private isDone(status: BackendReservation['statut']): boolean {
    return status === 'TERMINEE' || status === 'ANNULEE' || status === 'NO_SHOW';
  }

  private confirmationLabel(status: BackendReservation['statut']): string {
    const labels: Record<BackendReservation['statut'], string> = {
      EN_ATTENTE: 'Votre demande de rendez-vous est en attente',
      CONFIRMEE: 'Votre intervention est confirmee',
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

  private formatTime(date: Date): string {
    if (Number.isNaN(date.getTime())) return '--h--';

    return new Intl.DateTimeFormat('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
    }).format(date).replace(':', 'h');
  }
}
