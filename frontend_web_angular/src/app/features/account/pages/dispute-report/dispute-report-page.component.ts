import { CommonModule } from '@angular/common';
import { Component, OnInit, OnDestroy, computed, inject, signal } from '@angular/core';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { catchError, finalize, of, switchMap } from 'rxjs';
import { AppFeedbackService } from '../../../../core/feedback/app-feedback.service';
import { getHttpErrorMessage } from '../../../../core/http/api-response.utils';
import { BackNavigationService } from '../../../../core/navigation/back-navigation.service';
import { AppFooterComponent } from '../../../../shared/ui/app-footer/app-footer.component';
import { AppointmentsService } from '../../../appointments/data-access/appointments.service';
import { AppointmentView } from '../../../appointments/domain/appointments.models';

type DisputeReasonKey = 'bad_work' | 'provider_absent' | 'billing' | 'other';

const DISPUTE_EVIDENCE_ACCEPTED_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
]);
const DISPUTE_EVIDENCE_MAX_FILES = 4;
const DISPUTE_EVIDENCE_MAX_SIZE_BYTES = 10 * 1024 * 1024;

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
    AppFooterComponent,
  ],
  templateUrl: './dispute-report-page.component.html',
  styleUrl: './dispute-report-page.component.scss',
})
export class DisputeReportPageComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly backNavigation = inject(BackNavigationService);
  private readonly appointmentsService = inject(AppointmentsService);
  private readonly feedback = inject(AppFeedbackService);
  private readonly sanitizer = inject(DomSanitizer);

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
    this.backNavigation.back(null, '/litiges');
  }

  protected selectReason(reason: DisputeReasonKey): void {
    this.selectedReason.set(reason);
  }

  protected onEvidenceSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    input.value = '';
    if (files.length === 0) return;

    const nextFiles = [...this.evidenceFiles(), ...files];
    const validationMessage = this.validateEvidenceFiles(nextFiles);
    if (validationMessage) {
      this.errorMessage.set(validationMessage);
      this.feedback.error(validationMessage);
      return;
    }

    this.evidenceFiles.set(nextFiles);
  }

  private readonly previewUrls = new Map<File, SafeUrl>();
  private readonly objectUrls: string[] = [];

  ngOnDestroy(): void {
    this.objectUrls.forEach((url) => URL.revokeObjectURL(url));
  }

  protected isImageFile(file: File): boolean {
    return file.type.startsWith('image/');
  }

  protected getFilePreviewUrl(file: File): SafeUrl {
    if (this.previewUrls.has(file)) {
      return this.previewUrls.get(file)!;
    }
    const url = URL.createObjectURL(file);
    this.objectUrls.push(url);
    const safeUrl = this.sanitizer.bypassSecurityTrustUrl(url);
    this.previewUrls.set(file, safeUrl);
    return safeUrl;
  }

  protected removeEvidence(index: number): void {
    const file = this.evidenceFiles()[index];
    if (file) {
      this.previewUrls.delete(file);
    }
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
          this.router.navigate(['/litiges'], {
            queryParams: { reservationId: appointment.id },
          });
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
