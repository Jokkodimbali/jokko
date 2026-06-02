import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { catchError, finalize, of, switchMap } from 'rxjs';
import { AppFeedbackService } from '../../../../core/feedback/app-feedback.service';
import { getHttpErrorMessage } from '../../../../core/http/api-response.utils';
import { AppFooterComponent } from '../../../../shared/ui/app-footer/app-footer.component';
import { AppNavbarComponent } from '../../../../shared/ui/app-navbar/app-navbar.component';
import { AppointmentsService } from '../../../appointments/data-access/appointments.service';
import { AppointmentView } from '../../../appointments/domain/appointments.models';

type DisputeReasonKey = 'bad_work' | 'provider_absent' | 'billing' | 'other';

interface DisputeReasonOption {
  key: DisputeReasonKey;
  icon: string;
  label: string;
  caption: string;
}

@Component({
  selector: 'app-dispute-report-page',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    LucideAngularModule,
    AppNavbarComponent,
    AppFooterComponent,
  ],
  templateUrl: './dispute-report-page.component.html',
  styleUrl: './dispute-report-page.component.scss',
})
export class DisputeReportPageComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly appointmentsService = inject(AppointmentsService);
  private readonly feedback = inject(AppFeedbackService);

  protected readonly appointment = signal<AppointmentView | null>(null);
  protected readonly selectedReason = signal<DisputeReasonKey>('bad_work');
  protected readonly description = signal('');
  protected readonly evidenceFiles = signal<File[]>([]);
  protected readonly isLoading = signal(false);
  protected readonly isSubmitting = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  protected readonly reasonOptions: DisputeReasonOption[] = [
    {
      key: 'bad_work',
      icon: 'wrench',
      label: 'Travail mal fait ou incomplet',
      caption: 'Le resultat ne correspond pas a ce qui est convenu',
    },
    {
      key: 'provider_absent',
      icon: 'users',
      label: 'Le prestataire ne s est pas presente',
      caption: 'Absence sans preavis ni justificatif',
    },
    {
      key: 'billing',
      icon: 'banknote',
      label: 'Probleme de facture',
      caption: 'Le prix demande sur place etait different',
    },
    {
      key: 'other',
      icon: 'more-horizontal',
      label: 'Autre motif',
      caption: 'Veuillez preciser dans la description',
    },
  ];

  protected readonly selectedReasonLabel = computed(() => {
    return this.reasonOptions.find((option) => option.key === this.selectedReason())?.label ?? 'Autre motif';
  });

  ngOnInit(): void {
    const reservationId = this.route.snapshot.paramMap.get('id');
    if (!reservationId) {
      this.errorMessage.set('Reservation introuvable.');
      return;
    }

    this.isLoading.set(true);
    this.appointmentsService
      .getAppointmentById(reservationId)
      .pipe(
        catchError((error) => {
          this.errorMessage.set(getHttpErrorMessage(error, 'Impossible de charger cette reservation.'));
          return of(null);
        }),
        finalize(() => this.isLoading.set(false)),
      )
      .subscribe((appointment) => this.appointment.set(appointment));
  }

  protected goBack(): void {
    this.router.navigate(['/litiges']);
  }

  protected selectReason(reason: DisputeReasonKey): void {
    this.selectedReason.set(reason);
  }

  protected onEvidenceSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    if (files.length === 0) return;

    const supportedFiles = files.filter((file) => file.type.startsWith('image/') || file.type === 'application/pdf');
    this.evidenceFiles.set([...this.evidenceFiles(), ...supportedFiles].slice(0, 4));
    input.value = '';
  }

  protected removeEvidence(index: number): void {
    this.evidenceFiles.set(this.evidenceFiles().filter((_file, currentIndex) => currentIndex !== index));
  }

  protected canSubmit(appointment: AppointmentView | null): boolean {
    return appointment !== null && this.canOpenDispute(appointment) && this.description().trim().length >= 20;
  }

  protected submitDispute(): void {
    const appointment = this.appointment();
    if (!appointment || this.isSubmitting()) return;

    const description = this.description().trim();
    if (description.length < 20) {
      this.errorMessage.set('Decrivez la situation en au moins 20 caracteres.');
      return;
    }

    if (!this.canOpenDispute(appointment)) {
      this.errorMessage.set('Cette reservation ne peut pas encore etre signalee en litige.');
      return;
    }

    this.isSubmitting.set(true);
    this.errorMessage.set(null);
    this.appointmentsService
      .openDispute(appointment.id, this.buildBackendReason(description))
      .pipe(
        switchMap(() => {
          const files = this.evidenceFiles();
          return files.length > 0
            ? this.appointmentsService.uploadDisputeEvidence(appointment.id, files)
            : of([]);
        }),
        finalize(() => this.isSubmitting.set(false)),
      )
      .subscribe({
        next: () => {
          this.feedback.success('Litige soumis avec succes.');
          this.router.navigate(['/litiges', appointment.id, 'suivi']);
        },
        error: (error) => {
          const message = getHttpErrorMessage(error, 'Impossible de soumettre ce litige.');
          this.errorMessage.set(message);
          this.feedback.error(message);
        },
      });
  }

  protected canOpenDispute(appointment: AppointmentView): boolean {
    return appointment.status === 'TERMINEE' || appointment.status === 'NO_SHOW';
  }

  protected amountLabel(appointment: AppointmentView): string {
    return ['PAYEE_SEQUESTRE', 'EN_COURS', 'TERMINEE', 'NO_SHOW', 'LITIGE'].includes(appointment.status)
      ? 'Montant paye'
      : 'Montant estime';
  }

  protected formatMoney(value: number | null): string {
    return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(value ?? 0);
  }

  protected fileIcon(file: File): string {
    return file.type === 'application/pdf' ? 'file-text' : 'camera';
  }

  private buildBackendReason(description: string): string {
    return `Motif: ${this.selectedReasonLabel()}\nDescription: ${description}`.slice(0, 1000);
  }
}
