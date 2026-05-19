import { CommonModule, Location } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { forkJoin, of } from 'rxjs';
import { catchError, finalize, switchMap } from 'rxjs/operators';
import { AppFeedbackService } from '../../../../../core/feedback/app-feedback.service';
import { getHttpErrorMessage } from '../../../../../core/http/api-response.utils';
import { AppFooterComponent } from '../../../../../shared/ui/app-footer/app-footer.component';
import { AppNavbarComponent } from '../../../../../shared/ui/app-navbar/app-navbar.component';
import { AuthService } from '../../../../auth/data-access/auth.service';
import { UserProfileDto } from '../../../../auth/domain/models/auth.models';
import { ServiceProposalService } from '../../../../services/data-access/service-proposal.service';
import { ServicesService } from '../../../../services/data-access/services.service';
import {
  BackendProfessionalDetailService,
  ProviderProfileDetail,
} from '../../../../services/domain/models/services.models';

type AppointmentFor = 'ME' | 'RELATIVE';

type BookingDay = {
  date: Date;
  isoDate: string;
  label: string;
  availableCount: number;
  averageDuration: number;
  slots: Array<{
    dateHeure: string;
    label: string;
    available: boolean;
  }>;
};

@Component({
  selector: 'app-medicine-appointment-booking',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideAngularModule, AppNavbarComponent, AppFooterComponent],
  templateUrl: './medicine-appointment-booking.component.html',
  styleUrl: './medicine-appointment-booking.component.scss',
})
export class MedicineAppointmentBookingComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly location = inject(Location);
  private readonly servicesService = inject(ServicesService);
  private readonly proposalService = inject(ServiceProposalService);
  private readonly authService = inject(AuthService);
  private readonly feedback = inject(AppFeedbackService);

  protected readonly isLoading = signal(true);
  protected readonly isSubmitting = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly detail = signal<ProviderProfileDetail | null>(null);
  protected readonly user = signal<UserProfileDto | null>(null);
  protected readonly appointmentFor = signal<AppointmentFor>('ME');
  protected readonly selectedServiceId = signal<string>('');
  protected readonly expandedDay = signal<string | null>(null);
  protected readonly selectedDateTime = signal<string | null>(null);
  protected readonly bookingDays = signal<BookingDay[]>([]);
  protected readonly visibleSlots = signal(6);

  protected readonly doctorName = computed(() => {
    const detail = this.detail();
    return detail?.profile.nomEntreprise || detail?.profile.utilisateur.nom || 'Medecin non renseigne';
  });
  protected readonly selectedService = computed(() =>
    this.services().find((service) => service.id === this.selectedServiceId()) ?? null,
  );
  protected readonly services = computed(() =>
    (this.detail()?.services ?? []).filter((service) => service.estDisponible),
  );
  protected readonly canConfirm = computed(
    () => Boolean(this.selectedService()) && Boolean(this.selectedDateTime()) && !this.isSubmitting(),
  );

  ngOnInit(): void {
    this.loadPage();
  }

  protected goBack(): void {
    this.location.back();
  }

  protected selectAppointmentFor(value: AppointmentFor): void {
    this.appointmentFor.set(value);
  }

  protected selectService(serviceId: string): void {
    this.selectedServiceId.set(serviceId);
    this.selectedDateTime.set(null);
    this.expandedDay.set(null);
    this.visibleSlots.set(6);
    this.loadAvailability();
  }

  protected toggleDay(day: BookingDay): void {
    this.expandedDay.set(this.expandedDay() === day.isoDate ? null : day.isoDate);
    this.visibleSlots.set(6);
  }

  protected daySlots(day: BookingDay): BookingDay['slots'] {
    return day.slots.filter((slot) => slot.available).slice(0, this.visibleSlots());
  }

  protected showMoreSlots(day: BookingDay): void {
    if (this.expandedDay() !== day.isoDate) {
      this.expandedDay.set(day.isoDate);
    }
    this.visibleSlots.update((value) => value + 6);
  }

  protected selectSlot(slotDateTime: string): void {
    this.selectedDateTime.set(slotDateTime);
  }

  protected confirmAppointment(): void {
    const detail = this.detail();
    const service = this.selectedService();
    const dateHeure = this.selectedDateTime();
    if (!detail || !service || !dateHeure) {
      this.feedback.success('Selectionnez un motif et un creneau disponible.');
      return;
    }
    const adresseClient = this.resolveClientAddress(detail);
    if (!adresseClient) {
      this.feedback.success('Ajoutez une adresse dans votre profil avant de confirmer le rendez-vous.');
      return;
    }

    this.isSubmitting.set(true);
    this.proposalService
      .createDirectReservation({
        professionnelId: detail.profile.id,
        serviceId: service.id,
        dateHeure,
        adresseClient,
        dureeMinutes: service.dureeMinutes ?? 15,
        notes:
          this.appointmentFor() === 'RELATIVE'
            ? 'Rendez-vous pris pour un proche depuis l espace medecine.'
            : 'Rendez-vous medical pris depuis l espace medecine.',
      })
      .pipe(finalize(() => this.isSubmitting.set(false)))
      .subscribe({
        next: (reservation) => {
          const created = reservation as { id?: string };
          this.feedback.success('Rendez-vous cree avec succes.');
          if (created.id) {
            this.router.navigate(['/appointments', created.id, 'payment']);
          } else {
            this.router.navigate(['/appointments']);
          }
        },
        error: (error) =>
          this.feedback.success(getHttpErrorMessage(error, 'Creation du rendez-vous impossible.')),
      });
  }

  protected serviceLabel(service: BackendProfessionalDetailService): string {
    return `${service.nom} - ${service.dureeMinutes ?? 15} min - ${Number(service.prix).toLocaleString('fr-FR')} FCFA`;
  }

  private loadPage(): void {
    const profileId = this.route.snapshot.paramMap.get('id');
    if (!profileId) {
      this.errorMessage.set('Medecin introuvable.');
      this.isLoading.set(false);
      return;
    }

    this.servicesService
      .getProviderProfileDetail(profileId)
      .pipe(
        switchMap((detail) =>
          forkJoin({
            detail: of(detail),
            user: this.authService.myUserProfile().pipe(catchError(() => of(null))),
          }),
        ),
        finalize(() => this.isLoading.set(false)),
      )
      .subscribe({
        next: ({ detail, user }) => {
          this.detail.set(detail);
          this.user.set(user);
        },
        error: (error) =>
          this.errorMessage.set(getHttpErrorMessage(error, 'Impossible de charger ce medecin.')),
      });
  }

  private loadAvailability(): void {
    const detail = this.detail();
    const service = this.selectedService();
    if (!detail || !service) return;

    const dates = this.nextAppointmentDates(8);
    forkJoin(
      dates.map((date) =>
        this.proposalService
          .listReservationAvailabilitySlots({
            professionalId: detail.profile.id,
            date: this.toIsoDate(date),
            dureeMinutes: service.dureeMinutes ?? 15,
          })
          .pipe(catchError(() => of(null))),
      ),
    ).subscribe((results) => {
      const days = results
        .map((result, index) => {
          const date = dates[index];
          const slots = result?.slots ?? [];
          const availableSlots = slots.filter((slot) => slot.available);
          return {
            date,
            isoDate: this.toIsoDate(date),
            label: this.formatFullDate(date),
            availableCount: availableSlots.length,
            averageDuration: service.dureeMinutes ?? 15,
            slots,
          } satisfies BookingDay;
        })
        .filter((day) => day.availableCount > 0);

      this.bookingDays.set(days);
      this.expandedDay.set(days[0]?.isoDate ?? null);
    });
  }

  private nextAppointmentDates(count: number): Date[] {
    const dates: Date[] = [];
    const current = new Date();
    current.setDate(current.getDate() + 1);
    current.setHours(0, 0, 0, 0);

    while (dates.length < count) {
      dates.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }

    return dates;
  }

  private resolveClientAddress(detail: ProviderProfileDetail): string {
    void detail;
    return this.user()?.adresse?.trim() || '';
  }

  private toIsoDate(date: Date): string {
    return `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date
      .getDate()
      .toString()
      .padStart(2, '0')}`;
  }

  private formatFullDate(date: Date): string {
    return new Intl.DateTimeFormat('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })
      .format(date)
      .replace(/^\p{L}/u, (letter) => letter.toUpperCase());
  }
}
