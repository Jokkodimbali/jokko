import { CommonModule, Location } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { forkJoin, of } from 'rxjs';
import { catchError, finalize, switchMap } from 'rxjs/operators';
import { AppFeedbackService } from '../../../../../core/feedback/app-feedback.service';
import { getHttpErrorMessage } from '../../../../../core/http/api-response.utils';
import {
  BackendProfessionalAvailability,
  BackendProfessionalDetailService,
  Category,
} from '../../../../services/domain/models/services.models';
import {
  AppointmentStatus,
  BackendReservation,
} from '../../../../appointments/domain/appointments.models';
import {
  DoctorSpaceService,
  PatientMedicalProfile,
  DoctorWalletTransaction,
  DoctorWalletView,
} from '../../../data-access/doctor-space.service';
import { DoctorSpaceSidebarComponent } from './components/doctor-space-sidebar/doctor-space-sidebar.component';

type DoctorSpaceSection =
  | 'availability'
  | 'consultation'
  | 'agenda'
  | 'medical-history'
  | 'wallet';

type AvailabilitySlot = {
  id: string | null;
  startTime: string;
  endTime: string;
  isSaving?: boolean;
};

type AppointmentSlotPreview = {
  startTime: string;
  endTime: string;
};

type DaySchedule = {
  dayOfWeek: number;
  label: string;
  enabled: boolean;
  slots: AvailabilitySlot[];
};

type CalendarDay = {
  dayOfMonth: number;
  date: Date | null;
  isToday: boolean;
  isSelected: boolean;
  isOutside: boolean;
  isWorkingDay: boolean;
  isBlocked: boolean;
};

type ConsultationMotif = {
  id: string;
  categoryId: string;
  name: string;
  durationMinutes: number;
  price: number;
  isRequired: boolean;
};

type AgendaFilter = 'ALL' | 'CONFIRMED' | 'CANCELLED';
type AgendaViewMode = 'day' | 'week' | 'month';
type MedicalHistoryTab = 'future' | 'past';

type AgendaDay = {
  date: Date;
  dayLabel: string;
  dayNumber: string;
};

type AgendaEvent = {
  id: string;
  title: string;
  timeLabel: string;
  clientLabel: string;
  price: number;
  status: AppointmentStatus;
  dayIndex: number;
  rowStart: number;
  rowSpan: number;
  variant: 'confirmed' | 'cancelled';
};

type AgendaReservationDetail = BackendReservation;

type MedicalHistoryPatientOption = {
  id: string;
  label: string;
};

type MedicalHistoryDocument = {
  label: string;
  type: 'DOC';
};

type MedicalSpecialtyChip = {
  label: string;
  tone: 'red' | 'blue' | 'purple' | 'amber' | 'green' | 'gray' | 'mint' | 'pink';
};

type MedicalHistoryRow = {
  id: string;
  clientId: string;
  patientName: string;
  avatarUrl: string | null;
  serviceName: string;
  scheduledAt: Date;
  appointmentLabel: string;
  lastAppointmentLabel: string;
  isFuture: boolean;
  documents: MedicalHistoryDocument[];
};

type PatientMedicalDetail = MedicalHistoryRow & {
  reservation: BackendReservation;
  profile: PatientMedicalProfile;
  ageLabel: string;
  genderLabel: string;
  locationLabel: string;
  phoneLabel: string;
  alerts: string[];
  medicalActs: Array<{
    id: string;
    title: string;
    category: string;
    dateLabel: string;
  }>;
  availableSpecialties: MedicalSpecialtyChip[];
};

type WithdrawalMethodOption = {
  id: 'WAVE' | 'ORANGE_MONEY' | 'BANK_TRANSFER';
  label: string;
  detail: string;
  logoUrl?: string;
  enabled: boolean;
};

@Component({
  selector: 'app-doctor-space-page',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideAngularModule, DoctorSpaceSidebarComponent],
  templateUrl: './doctor-space-page.component.html',
  styleUrl: './doctor-space-page.component.scss',
})
export class DoctorSpacePageComponent implements OnInit {
  private readonly doctorSpaceService = inject(DoctorSpaceService);
  private readonly feedback = inject(AppFeedbackService);
  private readonly location = inject(Location);
  private readonly router = inject(Router);

  protected readonly activeSection = signal<DoctorSpaceSection>('availability');
  protected readonly isLoading = signal(false);
  protected readonly isSaving = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly professionalName = signal('Mon espace professionnel');
  protected readonly professionalProfileId = signal<string | null>(null);
  protected readonly days = signal<DaySchedule[]>(this.buildEmptyWeek());
  protected readonly motifs = signal<ConsultationMotif[]>([]);
  protected readonly editingMotifId = signal<string | null>(null);
  protected readonly categories = signal<Category[]>([]);
  protected readonly reservations = signal<BackendReservation[]>([]);
  protected readonly wallet = signal<DoctorWalletView | null>(null);
  protected readonly appointmentDuration = signal(20);
  protected readonly appointmentPause = signal(0);
  protected readonly agendaCursor = signal(this.startOfDay(new Date()));
  protected readonly agendaFilter = signal<AgendaFilter>('ALL');
  protected readonly agendaViewMode = signal<AgendaViewMode>('day');
  protected readonly medicalHistoryTab = signal<MedicalHistoryTab>('future');
  protected readonly medicalHistorySearch = signal('');
  protected readonly medicalHistoryPatientFilter = signal('ALL');
  protected readonly selectedPatientDetail = signal<PatientMedicalDetail | null>(null);
  protected readonly selectedAgendaReservation = signal<AgendaReservationDetail | null>(null);
  protected readonly isAgendaReservationLoading = signal(false);
  protected readonly isAgendaReservationCancelling = signal(false);
  protected readonly agendaReservationError = signal<string | null>(null);
  protected readonly isPatientDetailLoading = signal(false);
  protected readonly patientDetailError = signal<string | null>(null);
  protected readonly isWithdrawalModalOpen = signal(false);
  protected readonly agendaPeriodStart = signal('');
  protected readonly agendaPeriodEnd = signal('');
  protected readonly motifForm = {
    name: '',
    durationMinutes: 15,
    price: 10000,
    isRequired: true,
  };
  protected readonly withdrawalForm = {
    amount: 0,
    method: 'WAVE' as 'WAVE' | 'ORANGE_MONEY',
  };
  protected readonly patientActForm = {
    specialty: '',
    title: '',
    date: '',
    doctorName: '',
    notes: '',
    documentName: '',
  };
  protected readonly agendaCancelForm = {
    reason: '',
  };
  protected readonly withdrawalMethods: WithdrawalMethodOption[] = [
    {
      id: 'WAVE',
      label: 'WAVE',
      detail: 'Instantané · 0 FCFA',
      logoUrl: '/wave.png',
      enabled: true,
    },
    {
      id: 'ORANGE_MONEY',
      label: 'Orange Money',
      detail: 'Instantané · 1% frais',
      logoUrl: '/Orange-Money-logo.png',
      enabled: true,
    },
    {
      id: 'BANK_TRANSFER',
      label: 'Virement bancaire',
      detail: '1-3 jours ouvrés',
      enabled: false,
    },
  ];
  protected readonly calendarCursor = signal(this.startOfMonth(new Date()));
  protected readonly selectedCalendarDate = signal(this.startOfDay(new Date()));
  protected readonly isProviderSpace = computed(() =>
    this.router.url.startsWith('/prestataire/espace'),
  );
  protected readonly spaceAriaLabel = computed(() =>
    this.isProviderSpace() ? 'Espace prestataire' : 'Espace medecin',
  );
  protected readonly showConsultationSection = computed(() => !this.isProviderSpace());
  protected readonly motifRequiredCount = computed(
    () => this.motifs().filter((motif) => motif.isRequired).length,
  );
  protected readonly motifAveragePrice = computed(() => {
    const motifs = this.motifs();
    if (motifs.length === 0) return 0;
    return Math.round(
      motifs.reduce((total, motif) => total + motif.price, 0) / motifs.length,
    );
  });

  protected readonly calendarDays = computed(() =>
    this.buildCalendarDays(
      this.calendarCursor(),
      this.days(),
      this.selectedCalendarDate(),
    ),
  );
  protected readonly monthLabel = computed(() =>
    new Intl.DateTimeFormat('fr-FR', {
      month: 'short',
      year: 'numeric',
    }).format(this.calendarCursor()),
  );
  protected readonly durationProgress = computed(() =>
    this.progressPercent(this.appointmentDuration(), 20, 90),
  );
  protected readonly pauseProgress = computed(() =>
    this.progressPercent(this.appointmentPause(), 0, 30),
  );
  protected readonly appointmentStepMinutes = computed(() =>
    this.appointmentDuration() + this.appointmentPause(),
  );
  protected readonly weeklyAppointmentCapacity = computed(() =>
    this.days().reduce((total, day) => total + this.dayAppointmentCapacity(day), 0),
  );
  protected readonly agendaWeekDays = computed(() => this.buildAgendaWeekDays(this.agendaCursor()));
  protected readonly agendaDateLabel = computed(() =>
    new Intl.DateTimeFormat('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })
      .format(this.agendaCursor())
      .replace(/^\p{L}/u, (letter) => letter.toUpperCase()),
  );
  protected readonly agendaRows = computed(() => this.buildAgendaRows());
  protected readonly agendaEvents = computed(() => this.buildAgendaEvents());
  protected readonly agendaRevenue = computed(() =>
    this.sumPeriodRevenue((status) => status !== 'ANNULEE' && status !== 'NO_SHOW'),
  );
  protected readonly agendaCancelledRevenue = computed(() =>
    this.sumPeriodRevenue((status) => status === 'ANNULEE' || status === 'NO_SHOW'),
  );
  protected readonly agendaNextDelayLabel = computed(() => this.nextDelayLabel());
  protected readonly agendaPeriodCaption = computed(() => {
    switch (this.agendaViewMode()) {
      case 'day':
        return 'Ce jour';
      case 'week':
        return 'Cette semaine';
      case 'month':
        return 'Ce mois';
    }
  });
  protected readonly agendaZoomPercent = computed(() => {
    return this.appointmentStepMinutes();
  });
  protected readonly agendaRowHeight = computed(() => {
    const minutes = this.appointmentStepMinutes();
    if (minutes >= 75) return 48;
    if (minutes >= 60) return 42;
    if (minutes >= 45) return 36;
    if (minutes >= 30) return 31;
    return 34;
  });
  protected readonly medicalHistoryRows = computed(() => this.buildMedicalHistoryRows());
  protected readonly medicalHistoryFutureRows = computed(() =>
    this.medicalHistoryRows().filter((row) => row.isFuture),
  );
  protected readonly medicalHistoryPastRows = computed(() =>
    this.medicalHistoryRows().filter((row) => !row.isFuture),
  );
  protected readonly medicalHistoryVisibleRows = computed(() => {
    const selectedRows =
      this.medicalHistoryTab() === 'future'
        ? this.medicalHistoryFutureRows()
        : this.medicalHistoryPastRows();
    const search = this.medicalHistorySearch().trim().toLowerCase();
    const patientFilter = this.medicalHistoryPatientFilter();

    return selectedRows.filter((row) => {
      const matchesPatient = patientFilter === 'ALL' || row.clientId === patientFilter;
      const matchesSearch =
        !search ||
        row.patientName.toLowerCase().includes(search) ||
        row.serviceName.toLowerCase().includes(search);
      return matchesPatient && matchesSearch;
    });
  });
  protected readonly medicalHistoryPatients = computed<MedicalHistoryPatientOption[]>(() => {
    const patients = new Map<string, string>();
    for (const reservation of this.reservations()) {
      patients.set(reservation.clientId, this.clientLabel(reservation));
    }
    return Array.from(patients, ([id, label]) => ({ id, label })).sort((left, right) =>
      left.label.localeCompare(right.label, 'fr'),
    );
  });
  protected readonly pageTitle = computed(() => {
    switch (this.activeSection()) {
      case 'availability':
        return 'Mes disponibilités';
      case 'consultation':
        return 'Motifs de consultation';
      case 'agenda':
        return 'AGENDA INTERACTIF';
      case 'medical-history':
        return 'Historique médical';
      case 'wallet':
        return 'WALLET';
    }
  });
  protected readonly pageSubtitle = computed(() => {
    switch (this.activeSection()) {
      case 'availability':
        return "Vos modifications s'appliquent immédiatement à l'agenda des rendez-vous";
      case 'consultation':
        return 'Définissez les motifs du patient. Les motifs obligatoires devront être cochés à la prise de rendez-vous';
      case 'agenda':
        return '';
      case 'medical-history':
        return 'Consultez les informations médicales liées aux rendez-vous et aux patients.';
      case 'wallet':
        return 'Suivez vos revenus et retirez vos gains via Wave, Orange Money ou virement bancaire.';
    }
  });

  ngOnInit(): void {
    this.loadSchedule();
  }

  protected goBack(): void {
    this.location.back();
  }

  protected selectSection(section: DoctorSpaceSection): void {
    if (section === 'consultation' && !this.showConsultationSection()) {
      this.activeSection.set('availability');
      return;
    }

    this.activeSection.set(section);
  }

  protected selectAgendaFilter(filter: AgendaFilter): void {
    this.agendaFilter.set(filter);
  }

  protected selectAgendaViewMode(mode: AgendaViewMode): void {
    this.agendaViewMode.set(mode);
  }

  protected selectMedicalHistoryTab(tab: MedicalHistoryTab): void {
    this.medicalHistoryTab.set(tab);
  }

  protected updateMedicalHistorySearch(value: string): void {
    this.medicalHistorySearch.set(value);
  }

  protected updateMedicalHistoryPatientFilter(value: string): void {
    this.medicalHistoryPatientFilter.set(value);
  }

  protected openPatientMedicalDetail(row: MedicalHistoryRow): void {
    const reservation = this.reservations().find((item) => item.id === row.id);
    if (!reservation) {
      this.feedback.error('Impossible de retrouver le rendez-vous selectionne.');
      return;
    }

    this.isPatientDetailLoading.set(true);
    this.patientDetailError.set(null);
    this.selectedPatientDetail.set(null);

    this.doctorSpaceService
      .getPatientMedicalProfile(row.clientId)
      .pipe(finalize(() => this.isPatientDetailLoading.set(false)))
      .subscribe({
        next: (profile) => {
          this.selectedPatientDetail.set(this.buildPatientMedicalDetail(row, reservation, profile));
        },
        error: (error: unknown) => {
          this.patientDetailError.set(
            getHttpErrorMessage(error, 'Impossible de charger la fiche medicale du patient.'),
          );
        },
      });
  }

  protected closePatientMedicalDetail(): void {
    this.selectedPatientDetail.set(null);
    this.patientDetailError.set(null);
  }

  protected hasMedicalProfileValue(value: string | number | null | undefined): boolean {
    return value !== null && value !== undefined && `${value}`.trim().length > 0;
  }

  protected medicalValue(value: string | number | null | undefined, suffix = ''): string {
    if (!this.hasMedicalProfileValue(value)) return 'Non renseigne';
    return `${value}${suffix}`;
  }

  protected selectPatientActSpecialty(label: string): void {
    this.patientActForm.specialty = label;
  }

  protected onPatientActDocumentSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.patientActForm.documentName = input.files?.[0]?.name ?? '';
  }

  protected submitPatientAct(): void {
    this.feedback.error(
      "L'enregistrement d'un acte medical patient necessite encore l'endpoint backend dedie.",
    );
  }

  protected walletBalance(): number {
    return this.wallet()?.availableBalance ?? 0;
  }

  protected walletMonthlyRevenue(): number {
    return this.wallet()?.monthlyRevenue.amount ?? 0;
  }

  protected walletMonthlyChangeLabel(): string {
    const change = this.wallet()?.monthlyRevenue.changePercent ?? 0;
    const sign = change > 0 ? '+' : '';
    return `${sign}${change} % vs mois precedent`;
  }

  protected walletMonthlyChangePercent(): number {
    return this.wallet()?.monthlyRevenue.changePercent ?? 0;
  }

  protected walletConsultationCount(): number {
    return this.wallet()?.monthlyRevenue.consultationCount ?? 0;
  }

  protected walletTeleconsultationCount(): number {
    return this.wallet()?.monthlyRevenue.teleconsultationCount ?? 0;
  }

  protected walletRefundedCancellationCount(): number {
    return this.wallet()?.monthlyRevenue.refundedCancellationCount ?? 0;
  }

  protected walletTransactions(): DoctorWalletTransaction[] {
    return this.wallet()?.transactions ?? [];
  }

  protected openWithdrawalModal(): void {
    const balance = Math.floor(this.walletBalance());
    this.withdrawalForm.amount = balance >= 2000 ? Math.min(balance, 50000) : 0;
    this.isWithdrawalModalOpen.set(true);
  }

  protected closeWithdrawalModal(): void {
    if (this.isSaving()) return;
    this.isWithdrawalModalOpen.set(false);
  }

  protected selectWithdrawalMethod(method: WithdrawalMethodOption): void {
    if (!method.enabled || method.id === 'BANK_TRANSFER') return;
    this.withdrawalForm.method = method.id;
  }

  protected requestWalletWithdrawal(): void {
    const amount = Number(this.withdrawalForm.amount);
    if (!Number.isFinite(amount) || amount < 2000) {
      this.feedback.info('Le montant minimum de retrait est de 2000 FCFA.');
      return;
    }

    if (amount > this.walletBalance()) {
      this.feedback.info('Le montant depasse le solde disponible.');
      return;
    }

    this.isSaving.set(true);
    this.doctorSpaceService
      .requestWithdrawal({
        amount,
        method: this.withdrawalForm.method,
      })
      .pipe(
        switchMap(() => this.doctorSpaceService.getWallet()),
        finalize(() => this.isSaving.set(false)),
      )
      .subscribe({
        next: (wallet) => {
          this.wallet.set(wallet);
          this.withdrawalForm.amount = 0;
          this.isWithdrawalModalOpen.set(false);
          this.feedback.success('Retrait demande avec succes.');
        },
        error: (error) =>
          this.feedback.error(getHttpErrorMessage(error, 'Retrait impossible.')),
      });
  }

  protected zoomAgendaIn(): void {
    this.updateAppointmentDuration(Math.min(90, this.appointmentDuration() + 5));
    this.persistAppointmentSettings();
  }

  protected zoomAgendaOut(): void {
    this.updateAppointmentDuration(Math.max(20, this.appointmentDuration() - 5));
    this.persistAppointmentSettings();
  }

  protected openAgendaReservation(event: AgendaEvent): void {
    this.isAgendaReservationLoading.set(true);
    this.agendaReservationError.set(null);
    this.selectedAgendaReservation.set(null);
    this.agendaCancelForm.reason = '';

    this.doctorSpaceService
      .getReservationById(event.id)
      .pipe(finalize(() => this.isAgendaReservationLoading.set(false)))
      .subscribe({
        next: (reservation) => {
          this.selectedAgendaReservation.set(reservation);
          this.mergeReservation(reservation);
        },
        error: (error: unknown) => {
          this.agendaReservationError.set(
            getHttpErrorMessage(error, 'Impossible de charger le detail de cette reservation.'),
          );
        },
      });
  }

  protected closeAgendaReservation(): void {
    if (this.isAgendaReservationCancelling()) return;
    this.selectedAgendaReservation.set(null);
    this.agendaReservationError.set(null);
    this.agendaCancelForm.reason = '';
  }

  protected canCancelAgendaReservation(reservation: BackendReservation): boolean {
    return (
      !this.isCancelledStatus(reservation.statut) &&
      reservation.statut !== 'TERMINEE' &&
      reservation.statut !== 'LITIGE' &&
      this.isMoreThanHoursBefore(reservation.dateHeure, 24)
    );
  }

  protected cancelAgendaReservation(reservation: BackendReservation): void {
    if (!this.canCancelAgendaReservation(reservation) || this.isAgendaReservationCancelling()) {
      return;
    }

    const reason =
      this.agendaCancelForm.reason.trim() ||
      'Annulation demandee depuis l agenda professionnel.';
    this.isAgendaReservationCancelling.set(true);
    this.agendaReservationError.set(null);

    this.doctorSpaceService
      .cancelReservation(reservation.id, reason)
      .pipe(finalize(() => this.isAgendaReservationCancelling.set(false)))
      .subscribe({
        next: (updated) => {
          this.mergeReservation(updated);
          this.selectedAgendaReservation.set(updated);
          this.agendaCancelForm.reason = '';
          this.feedback.success('Reservation annulee et client notifie.');
        },
        error: (error: unknown) => {
          this.agendaReservationError.set(
            getHttpErrorMessage(error, 'Annulation impossible pour cette reservation.'),
          );
        },
      });
  }

  protected agendaReservationStatusLabel(status: AppointmentStatus): string {
    const labels: Record<AppointmentStatus, string> = {
      EN_ATTENTE: 'En attente',
      CONFIRMEE: 'Confirmee',
      PAYEE_SEQUESTRE: 'Payee en sequestre',
      EN_COURS: 'En cours',
      TERMINEE: 'Terminee',
      ANNULEE: 'Annulee',
      NO_SHOW: 'Absent',
      LITIGE: 'Litige',
    };

    return labels[status];
  }

  protected agendaReservationDateLabel(reservation: BackendReservation): string {
    const date = new Date(reservation.dateHeure);
    if (Number.isNaN(date.getTime())) return 'Date non renseignee';
    return new Intl.DateTimeFormat('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  }

  protected agendaReservationEndTimeLabel(reservation: BackendReservation): string {
    const date = new Date(reservation.dateHeure);
    if (Number.isNaN(date.getTime())) return '--:--';
    const end = new Date(date.getTime() + reservation.dureeMinutes * 60 * 1000);
    return this.formatAgendaTime(end);
  }

  protected agendaReservationPrice(reservation: BackendReservation): number {
    return Number(reservation.prixConvenu ?? reservation.service?.prix ?? 0);
  }

  protected agendaReservationServiceName(reservation: BackendReservation): string {
    return reservation.service?.nom ?? 'Service non renseigne';
  }

  protected agendaReservationCategoryName(reservation: BackendReservation): string {
    return reservation.service?.categorie?.nom ?? 'Categorie non renseignee';
  }

  protected previousAgendaWeek(): void {
    this.shiftAgendaPeriod(-1);
  }

  protected nextAgendaWeek(): void {
    this.shiftAgendaPeriod(1);
  }

  protected goToTodayAgenda(): void {
    this.agendaCursor.set(this.startOfDay(new Date()));
  }

  protected updateAgendaPeriodStart(value: string): void {
    this.agendaPeriodStart.set(value);
  }

  protected updateAgendaPeriodEnd(value: string): void {
    this.agendaPeriodEnd.set(value);
  }

  protected toggleDay(day: DaySchedule): void {
    if (this.isSaving()) return;
    const hasSlots = day.slots.length > 0;
    if (hasSlots) {
      this.disableDay(day);
      return;
    }

    this.createDefaultSlots(day.dayOfWeek);
  }

  protected addSlot(day: DaySchedule): void {
    if (this.isSaving()) return;
    const nextSlot = this.getNextSlot(day.slots);
    this.createSlot(day.dayOfWeek, nextSlot.startTime, nextSlot.endTime);
  }

  protected removeSlot(day: DaySchedule, slot: AvailabilitySlot): void {
    if (this.isSaving()) return;
    if (!slot.id) {
      this.days.update((days) =>
        days.map((item) =>
          item.dayOfWeek === day.dayOfWeek
            ? { ...item, slots: item.slots.filter((candidate) => candidate !== slot) }
            : item,
        ),
      );
      return;
    }

    this.isSaving.set(true);
    this.doctorSpaceService
      .deleteAvailability(slot.id)
      .pipe(finalize(() => this.isSaving.set(false)))
      .subscribe({
        next: () => {
          this.applyAvailabilities(
            this.days()
              .flatMap((item) =>
                item.slots
                  .filter((candidate) => candidate.id && candidate.id !== slot.id)
                  .map((candidate) =>
                    this.toAvailability(item.dayOfWeek, candidate.id!, candidate.startTime, candidate.endTime),
                  ),
              ),
          );
          this.feedback.success('Disponibilite supprimee.');
        },
        error: (error) => this.feedback.error(getHttpErrorMessage(error, 'Suppression impossible.')),
      });
  }

  protected saveSlot(day: DaySchedule, slot: AvailabilitySlot): void {
    if (this.isSaving() || !this.isValidSlot(slot)) return;

    if (!slot.id) {
      this.createSlot(day.dayOfWeek, slot.startTime, slot.endTime);
      return;
    }

    this.isSaving.set(true);
    this.doctorSpaceService
      .updateAvailability(slot.id, {
        dayOfWeek: day.dayOfWeek,
        startTime: slot.startTime,
        endTime: slot.endTime,
      })
      .pipe(finalize(() => this.isSaving.set(false)))
      .subscribe({
        next: () => {
          this.feedback.success('Horaire mis a jour.');
          this.refreshAvailabilities();
        },
        error: (error) => {
          this.feedback.error(getHttpErrorMessage(error, 'Mise a jour impossible.'));
          this.refreshAvailabilities();
        },
      });
  }

  protected trackDay(_index: number, day: DaySchedule): number {
    return day.dayOfWeek;
  }

  protected trackSlot(_index: number, slot: AvailabilitySlot): string {
    return slot.id ?? `${slot.startTime}-${slot.endTime}`;
  }

  protected trackAgendaDay(_index: number, day: AgendaDay): string {
    return day.date.toISOString();
  }

  protected trackAgendaRow(_index: number, row: string): string {
    return row;
  }

  protected trackAgendaEvent(_index: number, event: AgendaEvent): string {
    return event.id;
  }

  protected updateAppointmentDuration(value: string | number): void {
    const duration = this.normalizeMinutes(value, 20, 90);
    this.appointmentDuration.set(duration);
    this.motifForm.durationMinutes = duration;
  }

  protected updateAppointmentPause(value: string | number): void {
    this.appointmentPause.set(this.normalizeMinutes(value, 0, 30));
  }

  protected persistAppointmentSettings(): void {
    this.syncMotifDurationsWithAppointmentDuration();
  }

  protected dayAppointmentCapacity(day: DaySchedule): number {
    if (!day.enabled) return 0;
    return day.slots.reduce((total, slot) => total + this.availabilitySlotCapacity(slot), 0);
  }

  protected availabilitySlotCapacity(slot: AvailabilitySlot): number {
    return this.buildAppointmentSlotPreviews(slot).length;
  }

  protected availabilitySlotPreviews(slot: AvailabilitySlot): AppointmentSlotPreview[] {
    return this.buildAppointmentSlotPreviews(slot).slice(0, 6);
  }

  protected remainingAvailabilitySlotCount(slot: AvailabilitySlot): number {
    return Math.max(0, this.availabilitySlotCapacity(slot) - this.availabilitySlotPreviews(slot).length);
  }

  protected previousYear(): void {
    this.shiftCalendar(-12);
  }

  protected previousMonth(): void {
    this.shiftCalendar(-1);
  }

  protected nextMonth(): void {
    this.shiftCalendar(1);
  }

  protected nextYear(): void {
    this.shiftCalendar(12);
  }

  protected selectCalendarDay(day: CalendarDay): void {
    if (!day.date || day.isOutside) return;
    this.selectedCalendarDate.set(this.startOfDay(day.date));
  }

  protected addMotif(): void {
    const categoryId = this.resolveMotifCategoryId();
    const name = this.motifForm.name.trim();
    const durationMinutes = Number(this.motifForm.durationMinutes);
    const price = Number(this.motifForm.price);
    const editingMotifId = this.editingMotifId();

    if (!categoryId) {
      this.feedback.info('Ajoutez d abord un service medical pour definir la categorie du motif.');
      return;
    }
    if (!name || durationMinutes <= 0 || price <= 0) {
      this.feedback.info('Renseignez un nom, une duree et un tarif valides.');
      return;
    }

    this.isSaving.set(true);

    const request$ = editingMotifId
      ? this.doctorSpaceService.updateService(editingMotifId, {
          name,
          description: `Motif de consultation: ${name}`,
          price,
          priceType: 'FIXE',
          durationMinutes,
          isRequired: this.motifForm.isRequired,
        })
      : this.doctorSpaceService.createService({
          categoryId,
          name,
          description: `Motif de consultation: ${name}`,
          price,
          priceType: 'FIXE',
          durationMinutes,
          isRequired: this.motifForm.isRequired,
        });

    request$
      .pipe(finalize(() => this.isSaving.set(false)))
      .subscribe({
        next: () => {
          this.feedback.success(editingMotifId ? 'Motif mis a jour.' : 'Motif ajoute.');
          this.resetMotifForm();
          this.refreshServices();
        },
        error: (error) =>
          this.feedback.success(
            getHttpErrorMessage(
              error,
              editingMotifId ? 'Mise a jour du motif impossible.' : 'Creation du motif impossible.',
            ),
          ),
      });
  }

  protected editMotif(motif: ConsultationMotif): void {
    this.editingMotifId.set(motif.id);
    this.motifForm.name = motif.name;
    this.motifForm.durationMinutes = motif.durationMinutes;
    this.motifForm.price = motif.price;
    this.motifForm.isRequired = motif.isRequired;
  }

  protected resetMotifForm(): void {
    this.editingMotifId.set(null);
    this.motifForm.name = '';
    this.motifForm.durationMinutes = this.appointmentDuration();
    this.motifForm.price = 10000;
    this.motifForm.isRequired = true;
  }

  protected toggleMotifRequired(motif: ConsultationMotif): void {
    this.isSaving.set(true);
    this.doctorSpaceService
      .updateService(motif.id, { isRequired: !motif.isRequired })
      .pipe(finalize(() => this.isSaving.set(false)))
      .subscribe({
        next: () => this.refreshServices(),
        error: (error) => this.feedback.error(getHttpErrorMessage(error, 'Mise a jour impossible.')),
      });
  }

  protected deleteMotif(motif: ConsultationMotif): void {
    this.isSaving.set(true);
    this.doctorSpaceService
      .deleteService(motif.id)
      .pipe(finalize(() => this.isSaving.set(false)))
      .subscribe({
        next: () => {
          this.feedback.success('Motif supprime.');
          this.refreshServices();
        },
        error: (error) => this.feedback.error(getHttpErrorMessage(error, 'Suppression du motif impossible.')),
      });
  }

  private loadSchedule(): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);

    this.doctorSpaceService
      .getMyProfile()
      .pipe(
        switchMap((profile) => {
          this.professionalName.set(profile.utilisateur.nom);
          this.professionalProfileId.set(profile.id);
          return forkJoin({
            availabilities: this.doctorSpaceService
              .listMyAvailabilities()
              .pipe(catchError(() => of([] as BackendProfessionalAvailability[]))),
            services: this.doctorSpaceService
              .listMyServices()
              .pipe(catchError(() => of([] as BackendProfessionalDetailService[]))),
            categories: this.doctorSpaceService
              .listCategories()
              .pipe(catchError(() => of([] as Category[]))),
            reservations: this.doctorSpaceService
              .listMyReservations()
              .pipe(catchError(() => of([] as BackendReservation[]))),
            wallet: this.doctorSpaceService
              .getWallet()
              .pipe(catchError(() => of(null as DoctorWalletView | null))),
          });
        }),
        catchError((error) => {
          this.errorMessage.set(getHttpErrorMessage(error, "Impossible de charger l'espace prestataire."));
          return of({
            availabilities: [],
            services: [],
            categories: [],
            reservations: [],
            wallet: null,
          });
        }),
        finalize(() => this.isLoading.set(false)),
      )
      .subscribe(({ availabilities, services, categories, reservations, wallet }) => {
        this.applyAvailabilities(availabilities);
        this.applyServices(services);
        this.categories.set(categories);
        this.reservations.set(reservations);
        this.wallet.set(wallet);
      });
  }

  private refreshAvailabilities(): void {
    const profileId = this.professionalProfileId();
    if (!profileId) {
      this.loadSchedule();
      return;
    }

    this.doctorSpaceService.listMyAvailabilities().subscribe({
      next: (availabilities) => this.applyAvailabilities(availabilities),
      error: (error) => this.feedback.error(getHttpErrorMessage(error, 'Synchronisation impossible.')),
    });
  }

  private refreshServices(): void {
    const profileId = this.professionalProfileId();
    if (!profileId) return;

    this.doctorSpaceService.listMyServices().subscribe({
      next: (services) => this.applyServices(services),
      error: (error) => this.feedback.error(getHttpErrorMessage(error, 'Synchronisation des motifs impossible.')),
    });
  }

  private syncMotifDurationsWithAppointmentDuration(): void {
    const durationMinutes = this.appointmentDuration();
    const motifsToSync = this.motifs().filter((motif) => motif.durationMinutes !== durationMinutes);
    if (motifsToSync.length === 0) return;

    this.isSaving.set(true);
    forkJoin(
      motifsToSync.map((motif) =>
        this.doctorSpaceService.updateService(motif.id, { durationMinutes }),
      ),
    )
      .pipe(finalize(() => this.isSaving.set(false)))
      .subscribe({
        next: () => {
          this.motifs.update((motifs) =>
            motifs.map((motif) => ({ ...motif, durationMinutes })),
          );
          this.feedback.success('Duree des rendez-vous synchronisee avec les motifs.');
        },
        error: (error) =>
          this.feedback.error(getHttpErrorMessage(error, 'Synchronisation de la duree impossible.')),
      });
  }

  private mergeReservation(updated: BackendReservation): void {
    this.reservations.update((reservations) => {
      const exists = reservations.some((reservation) => reservation.id === updated.id);
      if (!exists) return [...reservations, updated];
      return reservations.map((reservation) => (reservation.id === updated.id ? updated : reservation));
    });
  }

  private buildAgendaRows(): string[] {
    const rows: string[] = [];
    const slotMinutes = this.appointmentStepMinutes();
    const minMinutes = 7 * 60;
    const maxMinutes = 14 * 60;

    for (let minutes = minMinutes; minutes <= maxMinutes; minutes += slotMinutes) {
      const hour = Math.floor(minutes / 60);
      const minute = minutes % 60;
      rows.push(`${hour}:${minute.toString().padStart(2, '0')}`);
    }

    if (rows[rows.length - 1] !== '14:00') {
      rows.push('14:00');
    }

    return rows;
  }

  private buildAgendaWeekDays(date: Date): AgendaDay[] {
    const monday = this.startOfWeek(date);
    return Array.from({ length: 7 }, (_, index) => {
      const current = new Date(monday);
      current.setDate(monday.getDate() + index);
      return {
        date: current,
        dayLabel: ['LUN', 'MAR', 'MER', 'JEU', 'VEN', 'SAM', 'DIM'][index],
        dayNumber: current.getDate().toString().padStart(2, '0'),
      };
    });
  }

  private buildAgendaEvents(): AgendaEvent[] {
    const weekDays = this.agendaWeekDays();
    const services = new Map(this.motifs().map((motif) => [motif.id, motif]));
    const startBoundary = this.parsePeriodBoundary(this.agendaPeriodStart(), false);
    const endBoundary = this.parsePeriodBoundary(this.agendaPeriodEnd(), true);

    return this.reservations()
      .map((reservation) => {
        const scheduledAt = new Date(reservation.dateHeure);
        if (Number.isNaN(scheduledAt.getTime())) return null;
        if (startBoundary && scheduledAt < startBoundary) return null;
        if (endBoundary && scheduledAt > endBoundary) return null;
        if (!this.matchesAgendaFilter(reservation.statut)) return null;

        const dayIndex = weekDays.findIndex((day) => this.isSameDay(day.date, scheduledAt));
        if (dayIndex < 0) return null;

        const startMinutes = scheduledAt.getHours() * 60 + scheduledAt.getMinutes();
        const minMinutes = 7 * 60;
        const maxMinutes = 14 * 60;
        if (startMinutes < minMinutes || startMinutes >= maxMinutes) return null;

        const localService = services.get(reservation.serviceId);
        const duration = Math.max(
          30,
          reservation.dureeMinutes ||
            reservation.service?.dureeMinutes ||
            localService?.durationMinutes ||
            30,
        );
        const slotMinutes = this.appointmentStepMinutes();
        const rowStart = 2 + Math.floor((startMinutes - minMinutes) / slotMinutes);
        const rowSpan = Math.max(1, Math.ceil((duration + this.appointmentPause()) / slotMinutes));
        const price =
          reservation.prixConvenu ??
          reservation.service?.prix ??
          localService?.price ??
          0;

        return {
          id: reservation.id,
          title: reservation.service?.nom ?? localService?.name ?? 'Consultation',
          timeLabel: `${this.formatAgendaTime(scheduledAt)} - ${this.formatAgendaTime(
            new Date(scheduledAt.getTime() + duration * 60 * 1000),
          )}`,
          clientLabel: this.clientLabel(reservation),
          price,
          status: reservation.statut,
          dayIndex,
          rowStart,
          rowSpan,
          variant: this.isCancelledStatus(reservation.statut) ? 'cancelled' : 'confirmed',
        } satisfies AgendaEvent;
      })
      .filter((event): event is AgendaEvent => event !== null);
  }

  private buildMedicalHistoryRows(): MedicalHistoryRow[] {
    const now = Date.now();
    return this.reservations()
      .map((reservation) => {
        const scheduledAt = new Date(reservation.dateHeure);
        if (Number.isNaN(scheduledAt.getTime())) return null;
        if (this.isCancelledStatus(reservation.statut)) return null;

        const isFuture =
          scheduledAt.getTime() >= now &&
          reservation.statut !== 'TERMINEE' &&
          reservation.statut !== 'LITIGE';

        return {
          id: reservation.id,
          clientId: reservation.clientId,
          patientName: this.clientLabel(reservation),
          avatarUrl: reservation.client?.urlAvatar ?? null,
          serviceName: reservation.service?.nom ?? 'Consultation',
          scheduledAt,
          appointmentLabel: this.formatMedicalHistoryAppointment(scheduledAt),
          lastAppointmentLabel: this.lastAppointmentLabelForClient(
            reservation.clientId,
            reservation.id,
          ),
          isFuture,
          documents: this.medicalHistoryDocuments(reservation),
        } satisfies MedicalHistoryRow;
      })
      .filter((row): row is MedicalHistoryRow => row !== null)
      .sort((left, right) =>
        left.isFuture === right.isFuture
          ? left.isFuture
            ? left.scheduledAt.getTime() - right.scheduledAt.getTime()
            : right.scheduledAt.getTime() - left.scheduledAt.getTime()
          : left.isFuture
            ? -1
            : 1,
      );
  }

  private buildPatientMedicalDetail(
    row: MedicalHistoryRow,
    reservation: BackendReservation,
    profile: PatientMedicalProfile,
  ): PatientMedicalDetail {
    return {
      ...row,
      reservation,
      profile,
      ageLabel: 'Non renseigne',
      genderLabel: 'Non renseigne',
      locationLabel: reservation.client?.adresse || reservation.adresseClient || 'Non renseigne',
      phoneLabel: reservation.client?.numeroTelephone || 'Non renseigne',
      alerts: [...profile.allergies, ...profile.conditions],
      medicalActs: this.patientMedicalActs(row.clientId),
      availableSpecialties: this.medicalSpecialtyChips(),
    };
  }

  private patientMedicalActs(clientId: string): PatientMedicalDetail['medicalActs'] {
    return this.reservations()
      .filter((reservation) => reservation.clientId === clientId)
      .filter((reservation) => !this.isCancelledStatus(reservation.statut))
      .map((reservation) => {
        const scheduledAt = new Date(reservation.dateHeure);
        return {
          id: reservation.id,
          title: reservation.service?.nom ?? 'Consultation',
          category: reservation.service?.categorie?.nom ?? 'Acte medical',
          dateLabel: Number.isNaN(scheduledAt.getTime())
            ? 'Date non renseignee'
            : this.formatMedicalHistoryDate(scheduledAt),
        };
      })
      .sort((left, right) => {
        const leftDate = new Date(
          this.reservations().find((reservation) => reservation.id === left.id)?.dateHeure ?? 0,
        ).getTime();
        const rightDate = new Date(
          this.reservations().find((reservation) => reservation.id === right.id)?.dateHeure ?? 0,
        ).getTime();
        return rightDate - leftDate;
      })
      .slice(0, 6);
  }

  private medicalSpecialtyChips(): MedicalSpecialtyChip[] {
    const tones: MedicalSpecialtyChip['tone'][] = [
      'red',
      'blue',
      'purple',
      'amber',
      'green',
      'gray',
      'mint',
      'pink',
    ];

    return this.categories()
      .slice(0, 20)
      .map((category, index) => ({
        label: category.nom,
        tone: tones[index % tones.length],
      }));
  }

  private medicalHistoryDocuments(reservation: BackendReservation): MedicalHistoryDocument[] {
    const notes = reservation.notes?.trim();
    if (!notes) return [];
    return [{ label: 'Notes du rendez-vous', type: 'DOC' }];
  }

  private lastAppointmentLabelForClient(clientId: string, excludedReservationId: string): string {
    const pastReservation = this.reservations()
      .filter((reservation) => reservation.clientId === clientId)
      .filter((reservation) => reservation.id !== excludedReservationId)
      .filter((reservation) => !this.isCancelledStatus(reservation.statut))
      .map((reservation) => new Date(reservation.dateHeure))
      .filter((date) => !Number.isNaN(date.getTime()))
      .filter((date) => date.getTime() < Date.now())
      .sort((left, right) => right.getTime() - left.getTime())[0];

    return pastReservation ? this.formatMedicalHistoryDate(pastReservation) : 'Aucun rendez-vous passe';
  }

  private formatMedicalHistoryAppointment(date: Date): string {
    const datePart = new Intl.DateTimeFormat('fr-FR', {
      weekday: 'short',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })
      .format(date)
      .replace('.', '');
    return `${datePart} — ${this.formatAgendaTime(date)}`;
  }

  private formatMedicalHistoryDate(date: Date): string {
    return new Intl.DateTimeFormat('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(date);
  }

  private sumPeriodRevenue(predicate: (status: AppointmentStatus) => boolean): number {
    const { start, end } = this.agendaStatPeriod();
    return this.reservations().reduce((total, reservation) => {
      const scheduledAt = new Date(reservation.dateHeure);
      if (
        Number.isNaN(scheduledAt.getTime()) ||
        scheduledAt < start ||
        scheduledAt > end ||
        !predicate(reservation.statut)
      ) {
        return total;
      }

      const service = this.motifs().find((motif) => motif.id === reservation.serviceId);
      return total + Number(reservation.prixConvenu ?? reservation.service?.prix ?? service?.price ?? 0);
    }, 0);
  }

  private agendaStatPeriod(): { start: Date; end: Date } {
    const cursor = this.agendaCursor();
    if (this.agendaViewMode() === 'day') {
      const start = this.startOfDay(cursor);
      const end = new Date(start);
      end.setHours(23, 59, 59, 999);
      return { start, end };
    }

    if (this.agendaViewMode() === 'week') {
      const start = this.startOfWeek(cursor);
      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      end.setHours(23, 59, 59, 999);
      return { start, end };
    }

    const start = this.startOfMonth(cursor);
    const end = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);
    end.setHours(23, 59, 59, 999);
    return { start, end };
  }

  private nextDelayLabel(): string {
    const now = new Date();
    const next = this.reservations()
      .map((reservation) => new Date(reservation.dateHeure))
      .filter((date, index) => {
        const reservation = this.reservations()[index];
        return date.getTime() > now.getTime() && !this.isCancelledStatus(reservation.statut);
      })
      .sort((left, right) => left.getTime() - right.getTime())[0];

    if (!next) return '--';
    const minutes = Math.max(1, Math.round((next.getTime() - now.getTime()) / 60000));
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;
    return rest ? `${hours}h${rest.toString().padStart(2, '0')}` : `${hours}h`;
  }

  private matchesAgendaFilter(status: AppointmentStatus): boolean {
    const filter = this.agendaFilter();
    if (filter === 'ALL') return true;
    if (filter === 'CANCELLED') return this.isCancelledStatus(status);
    return !this.isCancelledStatus(status);
  }

  protected isCancelledStatus(status: AppointmentStatus): boolean {
    return status === 'ANNULEE' || status === 'NO_SHOW';
  }

  private isMoreThanHoursBefore(value: string, hours: number): boolean {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return false;
    return date.getTime() - Date.now() > hours * 60 * 60 * 1000;
  }

  protected clientLabel(reservation: BackendReservation): string {
    return reservation.client?.nom || `Client ${reservation.clientId.slice(0, 6).toUpperCase()}`;
  }

  private shiftAgendaPeriod(direction: -1 | 1): void {
    const next = new Date(this.agendaCursor());
    switch (this.agendaViewMode()) {
      case 'day':
        next.setDate(next.getDate() + direction);
        break;
      case 'week':
        next.setDate(next.getDate() + direction * 7);
        break;
      case 'month':
        next.setMonth(next.getMonth() + direction);
        break;
    }
    this.agendaCursor.set(this.startOfDay(next));
  }

  private startOfWeek(date: Date): Date {
    const current = this.startOfDay(date);
    const mondayOffset = (current.getDay() + 6) % 7;
    current.setDate(current.getDate() - mondayOffset);
    return current;
  }

  private parsePeriodBoundary(value: string, endOfDay: boolean): Date | null {
    if (!value) return null;
    const date = new Date(`${value}T00:00:00`);
    if (Number.isNaN(date.getTime())) return null;
    if (endOfDay) date.setHours(23, 59, 59, 999);
    return date;
  }

  protected formatAgendaTime(value: Date | string): string {
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) return '--:--';
    return `${date.getHours().toString().padStart(2, '0')}:${date
      .getMinutes()
      .toString()
      .padStart(2, '0')}`;
  }

  private applyServices(services: BackendProfessionalDetailService[]): void {
    this.motifs.set(
      services
        .filter((service) => service.estDisponible)
        .map((service) => ({
          id: service.id,
          categoryId: service.categorieId,
          name: service.nom,
          durationMinutes: service.dureeMinutes ?? 15,
          price: Number(service.prix),
          isRequired: service.estObligatoire ?? false,
        })),
    );
  }

  private resolveMotifCategoryId(): string | null {
    const existingCategoryId = this.motifs()[0]?.categoryId;
    if (existingCategoryId) return existingCategoryId;

    return (
      this.categories().find((category) =>
        category.nom
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .toLowerCase()
          .includes('sante'),
      )?.id ??
      this.categories().find((category) =>
        category.nom
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .toLowerCase()
          .includes('medec'),
      )?.id ??
      null
    );
  }

  private disableDay(day: DaySchedule): void {
    const ids = day.slots.map((slot) => slot.id).filter((id): id is string => !!id);
    if (ids.length === 0) {
      this.applyDaySlots(day.dayOfWeek, []);
      return;
    }

    this.isSaving.set(true);
    forkJoin(ids.map((id) => this.doctorSpaceService.deleteAvailability(id)))
      .pipe(finalize(() => this.isSaving.set(false)))
      .subscribe({
        next: () => {
          this.applyDaySlots(day.dayOfWeek, []);
          this.feedback.success(`${day.label} est maintenant indisponible.`);
        },
        error: (error) => {
          this.feedback.error(getHttpErrorMessage(error, 'Desactivation impossible.'));
          this.refreshAvailabilities();
        },
      });
  }

  private createDefaultSlots(dayOfWeek: number): void {
    this.isSaving.set(true);
    forkJoin([
      this.doctorSpaceService.createAvailability({ dayOfWeek, startTime: '09:00', endTime: '12:00' }),
      this.doctorSpaceService.createAvailability({ dayOfWeek, startTime: '14:00', endTime: '17:00' }),
    ])
      .pipe(finalize(() => this.isSaving.set(false)))
      .subscribe({
        next: () => {
          this.feedback.success('Disponibilites activees.');
          this.refreshAvailabilities();
        },
        error: (error) => this.feedback.error(getHttpErrorMessage(error, 'Activation impossible.')),
      });
  }

  private createSlot(dayOfWeek: number, startTime: string, endTime: string): void {
    this.isSaving.set(true);
    this.doctorSpaceService
      .createAvailability({ dayOfWeek, startTime, endTime })
      .pipe(finalize(() => this.isSaving.set(false)))
      .subscribe({
        next: () => {
          this.feedback.success('Nouvelle disponibilite ajoutee.');
          this.refreshAvailabilities();
        },
        error: (error) => this.feedback.error(getHttpErrorMessage(error, 'Creation impossible.')),
      });
  }

  private applyAvailabilities(availabilities: BackendProfessionalAvailability[]): void {
    const nextDays = this.buildEmptyWeek();
    for (const availability of availabilities.filter((item) => item.estActive)) {
      const day = nextDays.find((item) => item.dayOfWeek === availability.jourSemaine);
      if (!day) continue;
      day.enabled = true;
      day.slots.push({
        id: availability.id,
        startTime: this.formatTime(availability.heureDebut),
        endTime: this.formatTime(availability.heureFin),
      });
    }

    for (const day of nextDays) {
      day.slots.sort((left, right) => left.startTime.localeCompare(right.startTime));
      day.enabled = day.slots.length > 0;
    }

    this.days.set(nextDays);
    this.updateAppointmentSettings(nextDays);
  }

  private applyDaySlots(dayOfWeek: number, slots: AvailabilitySlot[]): void {
    this.days.update((days) =>
      days.map((day) =>
        day.dayOfWeek === dayOfWeek
          ? { ...day, enabled: slots.length > 0, slots }
          : day,
      ),
    );
  }

  private updateAppointmentSettings(days: DaySchedule[]): void {
    const firstSlot = days.flatMap((day) => day.slots)[0];
    if (!firstSlot) {
      this.motifForm.durationMinutes = this.appointmentDuration();
      return;
    }

    const duration = Math.max(20, Math.min(90, this.minutesBetween(firstSlot.startTime, firstSlot.endTime) / 6));
    this.appointmentDuration.set(Math.round(duration / 5) * 5);
    this.appointmentPause.set(0);
    this.motifForm.durationMinutes = this.appointmentDuration();
  }

  private buildEmptyWeek(): DaySchedule[] {
    return [
      { dayOfWeek: 1, label: 'Lundi', enabled: false, slots: [] },
      { dayOfWeek: 2, label: 'Mardi', enabled: false, slots: [] },
      { dayOfWeek: 3, label: 'Mercredi', enabled: false, slots: [] },
      { dayOfWeek: 4, label: 'Jeudi', enabled: false, slots: [] },
      { dayOfWeek: 5, label: 'Vendredi', enabled: false, slots: [] },
      { dayOfWeek: 6, label: 'Samedi', enabled: false, slots: [] },
      { dayOfWeek: 0, label: 'Dimanche', enabled: false, slots: [] },
    ];
  }

  private buildCalendarDays(date: Date, days: DaySchedule[], selectedDate: Date): CalendarDay[] {
    const today = new Date();
    const year = date.getFullYear();
    const month = date.getMonth();
    const first = new Date(year, month, 1);
    const firstWeekDay = (first.getDay() + 6) % 7;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const enabledDays = new Set(days.filter((day) => day.enabled).map((day) => day.dayOfWeek));
    const cells: CalendarDay[] = [];

    for (let i = 0; i < firstWeekDay; i += 1) {
      cells.push({
        dayOfMonth: 0,
        date: null,
        isToday: false,
        isSelected: false,
        isOutside: true,
        isWorkingDay: false,
        isBlocked: false,
      });
    }
    for (let day = 1; day <= daysInMonth; day += 1) {
      const cellDate = new Date(year, month, day);
      const dayOfWeek = cellDate.getDay();
      const isWorkingDay = enabledDays.has(dayOfWeek);
      cells.push({
        dayOfMonth: day,
        isToday:
          day === today.getDate() &&
          month === today.getMonth() &&
          year === today.getFullYear(),
        isSelected: this.isSameDay(cellDate, selectedDate),
        date: cellDate,
        isWorkingDay,
        isBlocked: !isWorkingDay,
        isOutside: false,
      });
    }
    while (cells.length < 35) {
      cells.push({
        dayOfMonth: 0,
        date: null,
        isToday: false,
        isSelected: false,
        isOutside: true,
        isWorkingDay: false,
        isBlocked: false,
      });
    }
    return cells.slice(0, 35);
  }

  private shiftCalendar(monthDelta: number): void {
    const current = this.calendarCursor();
    const next = new Date(current.getFullYear(), current.getMonth() + monthDelta, 1);
    this.calendarCursor.set(next);
    this.selectedCalendarDate.set(this.startOfDay(next));
  }

  private startOfMonth(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), 1);
  }

  private startOfDay(date: Date): Date {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  }

  private isSameDay(left: Date, right: Date): boolean {
    return (
      left.getFullYear() === right.getFullYear() &&
      left.getMonth() === right.getMonth() &&
      left.getDate() === right.getDate()
    );
  }

  private progressPercent(value: number, min: number, max: number): number {
    return Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100));
  }

  private getNextSlot(slots: AvailabilitySlot[]): { startTime: string; endTime: string } {
    if (slots.length === 0) return { startTime: '09:00', endTime: '12:00' };
    if (slots.length === 1) return { startTime: '14:00', endTime: '17:00' };
    return { startTime: '17:00', endTime: '18:00' };
  }

  private isValidSlot(slot: AvailabilitySlot): boolean {
    return /^\d{2}:\d{2}$/.test(slot.startTime) && /^\d{2}:\d{2}$/.test(slot.endTime) && slot.startTime < slot.endTime;
  }

  private formatTime(value: string): string {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) {
      return `${date.getUTCHours().toString().padStart(2, '0')}:${date
        .getUTCMinutes()
        .toString()
        .padStart(2, '0')}`;
    }
    return value.slice(0, 5);
  }

  private minutesBetween(startTime: string, endTime: string): number {
    const [startHour, startMinute] = startTime.split(':').map(Number);
    const [endHour, endMinute] = endTime.split(':').map(Number);
    return endHour * 60 + endMinute - (startHour * 60 + startMinute);
  }

  private buildAppointmentSlotPreviews(slot: AvailabilitySlot): AppointmentSlotPreview[] {
    if (!this.isValidSlot(slot)) return [];

    const duration = this.appointmentDuration();
    const pause = this.appointmentPause();
    const step = duration + pause;
    const start = this.timeToMinutes(slot.startTime);
    const end = this.timeToMinutes(slot.endTime);
    const previews: AppointmentSlotPreview[] = [];

    for (let cursor = start; cursor + duration <= end; cursor += step) {
      previews.push({
        startTime: this.minutesToTime(cursor),
        endTime: this.minutesToTime(cursor + duration),
      });
    }

    return previews;
  }

  private normalizeMinutes(value: string | number, min: number, max: number): number {
    const numeric = Math.trunc(Number(value));
    if (!Number.isFinite(numeric)) return min;
    const clamped = Math.max(min, Math.min(max, numeric));
    return Math.round(clamped / 5) * 5;
  }

  private timeToMinutes(value: string): number {
    const [hour, minute] = value.split(':').map(Number);
    return hour * 60 + minute;
  }

  private minutesToTime(value: number): string {
    const normalized = ((value % 1440) + 1440) % 1440;
    const hour = Math.floor(normalized / 60);
    const minute = normalized % 60;
    return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
  }

  private toAvailability(
    dayOfWeek: number,
    id: string,
    startTime: string,
    endTime: string,
  ): BackendProfessionalAvailability {
    return {
      id,
      jourSemaine: dayOfWeek,
      heureDebut: startTime,
      heureFin: endTime,
      estActive: true,
    };
  }
}
