import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { catchError, finalize, of } from 'rxjs';
import { AppFeedbackService } from '../../../../core/feedback/app-feedback.service';
import { AuthSessionService } from '../../../../core/auth/auth-session.service';
import { getHttpErrorMessage } from '../../../../core/http/api-response.utils';
import { BackNavigationService } from '../../../../core/navigation/back-navigation.service';
import { AppFooterComponent } from '../../../../shared/ui/app-footer/app-footer.component';
import { AppointmentsService } from '../../../appointments/data-access/appointments.service';
import { AppointmentView, ReservationDisputeView } from '../../../appointments/domain/appointments.models';

type DisputeFilter = 'all' | 'upcoming' | 'completed' | 'disputed';

const DISPUTE_EVIDENCE_ACCEPTED_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
]);
const DISPUTE_EVIDENCE_MAX_FILES = 4;
const DISPUTE_EVIDENCE_MAX_SIZE_BYTES = 10 * 1024 * 1024;

@Component({
  selector: 'app-disputes-page',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    LucideAngularModule,
    AppFooterComponent,
  ],
  templateUrl: './disputes-page.component.html',
  styleUrl: './disputes-page.component.scss',
})
export class DisputesPageComponent implements OnInit {
  private readonly authSession = inject(AuthSessionService);
  private readonly appointmentsService = inject(AppointmentsService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly backNavigation = inject(BackNavigationService);
  private readonly feedback = inject(AppFeedbackService);

  protected readonly currentUser = this.authSession.currentUser;
  protected readonly appointments = signal<AppointmentView[]>([]);
  protected readonly activeFilter = signal<DisputeFilter>('all');
  protected readonly isLoading = signal(false);
  protected readonly isLoadingDispute = signal(false);
  protected readonly isUploading = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly selectedReservationId = signal<string | null>(null);
  protected readonly selectedDispute = signal<ReservationDisputeView | null>(null);

  protected readonly scope = computed(() => {
    const role = this.currentUser()?.role;
    return role === 'PRESTATAIRE' || role === 'MEDECIN' ? 'PRESTATAIRE' : 'CLIENT';
  });

  protected readonly disputedCount = computed(
    () => this.appointments().filter((appointment) => appointment.status === 'LITIGE').length,
  );
  protected readonly upcomingCount = computed(
    () => this.appointments().filter((appointment) => this.isUpcoming(appointment)).length,
  );
  protected readonly completedCount = computed(
    () => this.appointments().filter((appointment) => this.isCompleted(appointment)).length,
  );
  protected readonly filteredAppointments = computed(() => {
    const filter = this.activeFilter();
    const list = this.appointments();
    if (filter === 'upcoming') return list.filter((appointment) => this.isUpcoming(appointment));
    if (filter === 'completed') return list.filter((appointment) => this.isCompleted(appointment));
    if (filter === 'disputed') return list.filter((appointment) => appointment.status === 'LITIGE');
    return list;
  });
  protected readonly selectedAppointment = computed(() => {
    const selectedId = this.selectedReservationId();
    return this.appointments().find((appointment) => appointment.id === selectedId) ?? null;
  });
  protected readonly conversationCount = computed(() => this.selectedDispute()?.reservation.messages.length ?? 0);
  protected readonly photosCount = computed(
    () => this.selectedDispute()?.evidence.filter((item) => item.mimeType.startsWith('image/')).length ?? 0,
  );
  protected readonly invoicesCount = computed(
    () => this.selectedDispute()?.evidence.filter((item) => item.mimeType === 'application/pdf').length ?? 0,
  );

  ngOnInit(): void {
    if (!this.currentUser()) return;
    this.loadAppointments();
  }

  protected goBack(): void {
    this.backNavigation.back(null, '/services');
  }

  protected selectFilter(filter: DisputeFilter): void {
    this.activeFilter.set(filter);
  }

  protected openDisputePage(appointment: AppointmentView): void {
    if (!this.canOpenDispute(appointment) && appointment.status !== 'LITIGE') return;
    if (appointment.status === 'LITIGE') {
      this.selectDispute(appointment);
      return;
    }
    this.router.navigate(['/litiges', appointment.id]);
  }

  protected selectDispute(appointment: AppointmentView): void {
    if (appointment.status !== 'LITIGE') return;
    this.selectedReservationId.set(appointment.id);
    this.selectedDispute.set(null);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { reservationId: appointment.id },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
    this.loadDispute(appointment.id);
  }

  protected openDisputeConversation(): void {
    const reservationId = this.selectedDispute()?.reservationId ?? this.selectedReservationId();
    if (!reservationId) return;

    this.router.navigate(['/messages'], {
      queryParams: {
        reservationId,
        source: 'litige',
        returnUrl: this.router.url,
      },
    });
  }

  protected onEvidenceSelected(event: Event): void {
    const reservationId = this.selectedDispute()?.reservationId ?? this.selectedReservationId();
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    input.value = '';
    if (!reservationId || files.length === 0 || this.isUploading()) return;

    const validationMessage = this.validateEvidenceFiles(files);
    if (validationMessage) {
      this.errorMessage.set(validationMessage);
      this.feedback.error(validationMessage);
      return;
    }

    this.isUploading.set(true);
    this.errorMessage.set(null);
    this.appointmentsService
      .uploadDisputeEvidence(reservationId, files)
      .pipe(finalize(() => this.isUploading.set(false)))
      .subscribe({
        next: () => {
          this.feedback.success('Piece ajoutee au dossier.');
          this.loadDispute(reservationId, false);
        },
        error: (error) => {
          const message = getHttpErrorMessage(error, 'Impossible d ajouter cette piece.');
          this.errorMessage.set(message);
          this.feedback.error(message);
        },
      });
  }

  protected canOpenDispute(appointment: AppointmentView): boolean {
    return appointment.status === 'TERMINEE' || appointment.status === 'NO_SHOW';
  }

  protected amountLabel(appointment: AppointmentView): string {
    return this.isPaidLike(appointment) ? 'Montant paye' : 'Montant estime';
  }

  protected formatMoney(value: number | null): string {
    return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(value ?? 0);
  }

  protected shortRef(dispute: ReservationDisputeView): string {
    return `LIT-${new Date(dispute.ouvertLe).getFullYear()}-${dispute.id.slice(0, 4).toUpperCase()}`;
  }

  protected disputeServiceName(dispute: ReservationDisputeView): string {
    return dispute.reservation.service.nom;
  }

  protected disputeStatusLabel(dispute: ReservationDisputeView): string {
    const labels: Record<string, string> = {
      OUVERT: 'Mediation',
      EN_REVUE: 'Examen des preuves',
      RESOLU: 'Resolu',
      REJETE: 'Rejete',
    };
    return labels[dispute.statut] ?? dispute.statut;
  }

  protected paymentLabel(dispute: ReservationDisputeView): string {
    if (!dispute.payment) return 'Non sequestre';
    const labels: Record<string, string> = {
      LOCKED: 'Sequestre',
      DISPUTED: 'Sequestre',
      RELEASED: 'Verse',
      REFUNDED: 'Rembourse',
    };
    return labels[dispute.payment.escrowStatus] ?? dispute.payment.escrowStatus;
  }

  protected disputeAmount(dispute: ReservationDisputeView): number {
    return dispute.payment?.montant ?? dispute.reservation.prixConvenu ?? dispute.reservation.service.prix;
  }

  protected formatDate(date: string | Date): string {
    return new Intl.DateTimeFormat('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(new Date(date));
  }

  protected statusLabel(appointment: AppointmentView): string {
    if (this.canOpenDispute(appointment)) return 'Signalez le litige';

    const labels: Record<AppointmentView['status'], string> = {
      EN_ATTENTE: 'A venir',
      CONFIRMEE: 'A venir',
      PAYEE_SEQUESTRE: 'Confirmee',
      EN_COURS: 'En cours',
      TERMINEE: 'Terminee',
      ANNULEE: 'Annulee',
      NO_SHOW: 'Absent',
      LITIGE: 'Litige en cours',
    };
    return labels[appointment.status];
  }

  protected statusTone(appointment: AppointmentView): string {
    if (this.canOpenDispute(appointment)) return 'report';
    if (appointment.status === 'LITIGE') return 'dispute';
    if (this.isUpcoming(appointment)) return 'upcoming';
    return 'neutral';
  }

  protected actionLabel(appointment: AppointmentView): string {
    if (appointment.status === 'LITIGE') return 'Voir';
    if (this.canOpenDispute(appointment)) return 'Signaler litige';
    return 'Indisponible';
  }

  protected trackById(_index: number, appointment: AppointmentView): string {
    return appointment.id;
  }

  private loadAppointments(): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);
    this.appointmentsService
      .listMyAppointments(this.scope())
      .pipe(
        catchError((error) => {
          this.errorMessage.set(getHttpErrorMessage(error, 'Impossible de charger vos reservations.'));
          return of([]);
        }),
        finalize(() => this.isLoading.set(false)),
      )
      .subscribe((appointments) => {
        this.appointments.set(appointments);
        this.restoreSelectedDispute(appointments);
      });
  }

  private loadDispute(reservationId: string, showLoading = true): void {
    if (showLoading) this.isLoadingDispute.set(true);
    this.errorMessage.set(null);
    this.appointmentsService
      .getReservationDispute(reservationId)
      .pipe(
        catchError((error) => {
          this.errorMessage.set(getHttpErrorMessage(error, 'Impossible de charger le resume du litige.'));
          return of(null);
        }),
        finalize(() => this.isLoadingDispute.set(false)),
      )
      .subscribe((dispute) => this.selectedDispute.set(dispute));
  }

  private restoreSelectedDispute(appointments: AppointmentView[]): void {
    const requestedId = this.route.snapshot.queryParamMap.get('reservationId');
    const selected =
      appointments.find((appointment) => appointment.id === requestedId && appointment.status === 'LITIGE') ??
      appointments.find((appointment) => appointment.status === 'LITIGE') ??
      null;

    if (!selected) return;
    this.selectedReservationId.set(selected.id);
    this.activeFilter.set('disputed');
    this.loadDispute(selected.id);
  }

  protected isUpcoming(appointment: AppointmentView): boolean {
    return ['EN_ATTENTE', 'CONFIRMEE', 'PAYEE_SEQUESTRE', 'EN_COURS'].includes(appointment.status);
  }

  private isCompleted(appointment: AppointmentView): boolean {
    return appointment.status === 'TERMINEE' || appointment.status === 'NO_SHOW';
  }

  private isPaidLike(appointment: AppointmentView): boolean {
    return ['PAYEE_SEQUESTRE', 'EN_COURS', 'TERMINEE', 'NO_SHOW', 'LITIGE'].includes(appointment.status);
  }

  private validateEvidenceFiles(files: File[]): string | null {
    if (files.length > DISPUTE_EVIDENCE_MAX_FILES) {
      return 'Ajoutez 4 pieces maximum a la fois.';
    }

    if (files.some((file) => !DISPUTE_EVIDENCE_ACCEPTED_TYPES.has(file.type))) {
      return 'Formats acceptes : JPG, PNG, WEBP ou PDF.';
    }

    if (files.some((file) => file.size > DISPUTE_EVIDENCE_MAX_SIZE_BYTES)) {
      return 'Chaque piece jointe doit faire 10 Mo maximum.';
    }

    return null;
  }
}
