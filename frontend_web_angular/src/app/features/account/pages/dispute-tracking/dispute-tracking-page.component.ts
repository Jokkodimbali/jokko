import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { catchError, finalize, of } from 'rxjs';
import { AppFeedbackService } from '../../../../core/feedback/app-feedback.service';
import { getHttpErrorMessage } from '../../../../core/http/api-response.utils';
import { AppFooterComponent } from '../../../../shared/ui/app-footer/app-footer.component';
import { AppNavbarComponent } from '../../../../shared/ui/app-navbar/app-navbar.component';
import { AppointmentsService } from '../../../appointments/data-access/appointments.service';
import { ReservationDisputeView } from '../../../appointments/domain/appointments.models';

@Component({
  selector: 'app-dispute-tracking-page',
  standalone: true,
  imports: [CommonModule, LucideAngularModule, AppNavbarComponent, AppFooterComponent],
  templateUrl: './dispute-tracking-page.component.html',
  styleUrl: './dispute-tracking-page.component.scss',
})
export class DisputeTrackingPageComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly appointmentsService = inject(AppointmentsService);
  private readonly feedback = inject(AppFeedbackService);

  protected readonly dispute = signal<ReservationDisputeView | null>(null);
  protected readonly isLoading = signal(false);
  protected readonly isUploading = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  protected readonly conversationCount = computed(() => this.dispute()?.reservation.messages.length ?? 0);
  protected readonly photosCount = computed(
    () => this.dispute()?.evidence.filter((item) => item.mimeType.startsWith('image/')).length ?? 0,
  );
  protected readonly invoicesCount = computed(
    () => this.dispute()?.evidence.filter((item) => item.mimeType === 'application/pdf').length ?? 0,
  );

  ngOnInit(): void {
    this.loadDispute();
  }

  protected goBack(): void {
    this.router.navigate(['/litiges']);
  }

  protected messageMediator(): void {
    const dispute = this.dispute();
    if (!dispute) return;

    this.router.navigate(['/litiges', dispute.reservationId, 'messages']);
  }

  protected onEvidenceSelected(event: Event): void {
    const dispute = this.dispute();
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    input.value = '';
    if (!dispute || files.length === 0 || this.isUploading()) return;

    this.isUploading.set(true);
    this.errorMessage.set(null);
    this.appointmentsService
      .uploadDisputeEvidence(dispute.reservationId, files.slice(0, 4))
      .pipe(finalize(() => this.isUploading.set(false)))
      .subscribe({
        next: () => {
          this.feedback.success('Piece ajoutee au dossier.');
          this.loadDispute(false);
        },
        error: (error) => {
          this.errorMessage.set(getHttpErrorMessage(error, 'Impossible d ajouter cette piece.'));
        },
      });
  }

  protected shortRef(dispute: ReservationDisputeView): string {
    return `LIT-${new Date(dispute.ouvertLe).getFullYear()}-${dispute.id.slice(0, 4).toUpperCase()}`;
  }

  protected serviceName(dispute: ReservationDisputeView): string {
    return dispute.reservation.service.nom;
  }

  protected statusLabel(dispute: ReservationDisputeView): string {
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

  protected formatMoney(amount: number): string {
    return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(amount);
  }

  protected formatDate(date: string | Date): string {
    return new Intl.DateTimeFormat('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(new Date(date));
  }

  protected formatDateTime(date: string | Date): string {
    return new Intl.DateTimeFormat('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(date)).replace(':', 'h');
  }

  protected dueDate(dispute: ReservationDisputeView): Date {
    const date = new Date(dispute.ouvertLe);
    date.setDate(date.getDate() + 2);
    return date;
  }

  protected initials(name: string): string {
    return name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('') || 'JD';
  }

  private loadDispute(showLoading = true): void {
    const reservationId = this.route.snapshot.paramMap.get('id');
    if (!reservationId) {
      this.errorMessage.set('Reservation introuvable.');
      return;
    }

    if (showLoading) this.isLoading.set(true);
    this.errorMessage.set(null);
    this.appointmentsService
      .getReservationDispute(reservationId)
      .pipe(
        catchError((error) => {
          this.errorMessage.set(getHttpErrorMessage(error, 'Impossible de charger le suivi du litige.'));
          return of(null);
        }),
        finalize(() => this.isLoading.set(false)),
      )
      .subscribe((dispute) => this.dispute.set(dispute));
  }
}
