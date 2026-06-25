import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { firstValueFrom, forkJoin, of } from 'rxjs';
import { catchError, finalize, switchMap } from 'rxjs/operators';
import { AuthSessionService } from '../../../../../core/auth/auth-session.service';
import { AppFeedbackService } from '../../../../../core/feedback/app-feedback.service';
import { getHttpErrorMessage } from '../../../../../core/http/api-response.utils';
import { BackNavigationService } from '../../../../../core/navigation/back-navigation.service';
import { AuthService } from '../../../../auth/data-access/auth.service';
import {
  SENEGAL_PHONE_PATTERN,
  normalizeSenegalPhoneNumber,
} from '../../../../auth/domain/auth.validators';
import { UserProfileDto } from '../../../../auth/domain/models/auth.models';
import {
  ReservationAvailabilitySlotView,
  ServiceProposalService,
} from '../../../../services/data-access/service-proposal.service';
import {
  ProposalDetailsModal,
  ServiceProposalDetailsModalComponent,
} from '../../../../services/presentation/components/service-proposal-details-modal/service-proposal-details-modal.component';
import { ServicesService } from '../../../../services/data-access/services.service';
import {
  BackendProfessionalDetailService,
  ProviderProfileDetail,
} from '../../../../services/domain/models/services.models';
import { publicAssetUrl } from '../../../../../shared/utils/public-asset-url';
import { GoogleMapsLoaderService } from '../../../../../shared/maps/google-maps-loader.service';

type AppointmentFor = 'ME' | 'RELATIVE';
type BookingStep = 'PERSONAL' | 'RESERVATION';
type PatientFormField = 'fullName' | 'phoneNumber' | 'relationship' | 'address' | 'notes';

interface RelativePatientForm {
  fullName: string;
  phoneNumber: string;
  relationship: string;
  address: string;
  notes: string;
}

interface AppointmentLocation {
  label: string;
  latitude: number;
  longitude: number;
  accuracyMeters: number | null;
  source: 'GPS' | 'GOOGLE_PLACES';
}

type CalendarDay = {
  date: Date;
  isoDate: string;
  weekdayLabel: string;
  dayNumber: string;
  monthLabel: string;
  isToday: boolean;
  isPast: boolean;
};

const IDEAL_GPS_ACCURACY_METERS = 80;
const MAX_ACCEPTED_GPS_ACCURACY_METERS = 150;
const GPS_COLLECTION_TIMEOUT_MS = 12_000;

@Component({
  selector: 'app-medicine-appointment-booking',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideAngularModule, ServiceProposalDetailsModalComponent],
  templateUrl: './medicine-appointment-booking.component.html',
  styleUrl: './medicine-appointment-booking.component.scss',
})
export class MedicineAppointmentBookingComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly backNavigation = inject(BackNavigationService);
  private readonly servicesService = inject(ServicesService);
  private readonly proposalService = inject(ServiceProposalService);
  private readonly authService = inject(AuthService);
  private readonly authSession = inject(AuthSessionService);
  private readonly feedback = inject(AppFeedbackService);
  private readonly googleMaps = inject(GoogleMapsLoaderService);

  protected readonly isLoading = signal(true);
  protected readonly isSubmitting = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly detail = signal<ProviderProfileDetail | null>(null);
  protected readonly user = signal<UserProfileDto | null>(null);
  protected readonly activeStep = signal<BookingStep>('PERSONAL');
  protected readonly appointmentFor = signal<AppointmentFor>('ME');
  protected readonly selectedServiceId = signal<string>('');
  protected readonly selectedDateIso = signal<string>('');
  protected readonly selectedDateTime = signal<string | null>(null);
  protected readonly activeDetailsModal = signal<ProposalDetailsModal | null>(null);
  protected readonly calendarDays = signal<CalendarDay[]>([]);
  protected readonly selectedDateSlots = signal<ReservationAvailabilitySlotView[]>([]);
  protected readonly isLoadingSlots = signal(false);
  protected readonly weekdayHeaders = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
  protected readonly relativePatient = signal<RelativePatientForm>({
    fullName: '',
    phoneNumber: '',
    relationship: '',
    address: '',
    notes: '',
  });
  protected readonly fieldErrors = signal<Partial<Record<PatientFormField | 'selfAddress', string>>>({});
  protected readonly appointmentAddressOverride = signal('');
  protected readonly appointmentLocation = signal<AppointmentLocation | null>(null);
  protected readonly isLocatingAddress = signal(false);

  protected readonly doctorName = computed(() => {
    const detail = this.detail();
    return detail?.profile.nomEntreprise || detail?.profile.utilisateur.nom || 'Medecin non renseigne';
  });
  protected readonly doctorAvatarUrl = computed(() =>
    publicAssetUrl(this.detail()?.profile.utilisateur.urlAvatar) || '',
  );
  protected readonly doctorInitials = computed(() => this.initials(this.doctorName()));
  protected readonly doctorRatingLabel = computed(() =>
    Number(this.detail()?.profile.noteGlobale ?? 0).toFixed(1),
  );
  protected readonly doctorReviewsLabel = computed(() =>
    `${this.detail()?.profile.nombreAvis ?? 0} avis`,
  );
  protected readonly doctorStatusLabel = computed(() =>
    this.detail()?.presence.isOnline ? 'Disponible' : 'Indisponible',
  );
  protected readonly selectedService = computed(() =>
    this.services().find((service) => service.id === this.selectedServiceId()) ?? null,
  );
  protected readonly services = computed(() =>
    (this.detail()?.services ?? []).filter((service) => service.estDisponible),
  );
  protected readonly userName = computed(() => this.user()?.nom?.trim() || 'Nom non renseigne');
  protected readonly userPhone = computed(
    () => this.user()?.numeroTelephone?.trim() || 'Telephone non renseigne',
  );
  protected readonly userAddress = computed(() => this.user()?.adresse?.trim() || '');
  protected readonly locationSummary = computed(() => {
    const location = this.appointmentLocation();
    if (!location) return 'Adresse textuelle uniquement';
    const accuracy = location.accuracyMeters === null
      ? 'precision Google Maps'
      : `precision ${Math.round(location.accuracyMeters)} m`;
    return `${location.label} - ${location.latitude.toFixed(5)}, ${location.longitude.toFixed(5)} (${accuracy})`;
  });
  protected readonly selectedSlotLabel = computed(() => {
    const dateHeure = this.selectedDateTime();
    if (!dateHeure) return 'Aucun creneau choisi';

    const slot = this.selectedDateSlots().find((item) => item.dateHeure === dateHeure);
    if (slot) return `${this.selectedDateLabel()} a ${slot.label}`;

    return 'Creneau selectionne';
  });
  protected readonly minAppointmentDay = computed(() => this.toIsoDate(new Date()));
  protected readonly availabilityLabel = computed(() => {
    if (this.isLoadingSlots()) {
      return 'Chargement des heures du medecin...';
    }

    if (this.selectedDateSlots().length === 0) {
      return 'Aucun creneau disponible pour cette date.';
    }

    if (!this.selectedDateTime()) {
      return 'Selectionnez une heure disponible.';
    }

    return `Creneau choisi : ${this.selectedSlotLabel()}`;
  });
  protected readonly selectedDateLabel = computed(() => {
    const selected = this.calendarDays().find((day) => day.isoDate === this.selectedDateIso());
    if (!selected) return 'Date a choisir';
    return this.formatFullDate(selected.date);
  });
  protected readonly selectedDateShortLabel = computed(() => {
    const dateHeure = this.selectedDateTime();
    if (!dateHeure) return 'Date';

    return new Intl.DateTimeFormat('fr-FR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    }).format(new Date(dateHeure)).toUpperCase();
  });
  protected readonly selectedTimeLabel = computed(() => {
    const dateHeure = this.selectedDateTime();
    if (!dateHeure) return 'Heure';

    return new Intl.DateTimeFormat('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(dateHeure)).replace(':', 'h');
  });
  protected readonly availableSlotsCount = computed(
    () => this.selectedDateSlots().filter((slot) => slot.available).length,
  );
  protected readonly reservedSlotsCount = computed(
    () => this.selectedDateSlots().filter((slot) => slot.status === 'RESERVED').length,
  );
  protected readonly unavailableSlotsCount = computed(
    () => this.selectedDateSlots().filter((slot) => slot.status === 'UNAVAILABLE').length,
  );
  protected readonly priceLabel = computed(() => {
    return `${this.selectedServicePrice().toLocaleString('fr-FR')} FCFA`;
  });
  protected readonly selectedServicePrice = computed(() => {
    const price = Number(this.selectedService()?.prix ?? 0);
    return Number.isFinite(price) ? price : 0;
  });
  protected readonly canConfirm = computed(
    () =>
      Boolean(this.selectedService()) &&
      Boolean(this.selectedDateTime()) &&
      !this.isSubmitting(),
  );

  ngOnInit(): void {
    this.loadPage();
  }

  protected goBack(): void {
    const profileId = this.route.snapshot.paramMap.get('id');
    this.backNavigation.back(
      this.route.snapshot.queryParamMap.get('returnUrl'),
      profileId ? `/medecine/${profileId}` : '/services',
    );
  }

  protected selectAppointmentFor(value: AppointmentFor): void {
    this.appointmentFor.set(value);
    this.fieldErrors.set({});
    this.appointmentLocation.set(null);
    this.appointmentAddressOverride.set('');
  }

  protected goToPersonalStep(): void {
    this.activeStep.set('PERSONAL');
  }

  protected goToReservationStep(): void {
    if (!this.validatePersonalStep()) {
      this.feedback.info('Completez les informations personnelles avant de continuer.');
      return;
    }

    this.activeStep.set('RESERVATION');
  }

  protected openDetailsModal(modal: ProposalDetailsModal): void {
    this.activeDetailsModal.set(modal);
  }

  protected closeDetailsModal(): void {
    this.activeDetailsModal.set(null);
  }

  protected selectService(serviceId: string): void {
    this.selectedServiceId.set(serviceId);
    this.selectedDateTime.set(null);
    this.loadAvailabilityForSelectedDate();
  }

  protected selectCalendarDate(day: CalendarDay): void {
    if (this.selectedDateIso() === day.isoDate) return;
    this.selectedDateIso.set(day.isoDate);
    this.selectedDateTime.set(null);
    this.loadAvailabilityForSelectedDate();
  }

  protected updateAppointmentDay(value: string): void {
    if (!value || this.selectedDateIso() === value) return;
    this.selectedDateIso.set(value);
    this.selectedDateTime.set(null);
    this.loadAvailabilityForSelectedDate();
  }

  protected selectSlot(slot: ReservationAvailabilitySlotView): void {
    if (!slot.available) {
      this.feedback.info(this.slotStatusLabel(slot));
      return;
    }

    const scheduledAt = new Date(slot.dateHeure);
    if (scheduledAt.getTime() <= Date.now()) {
      this.feedback.info('Ce creneau est deja depasse.');
      return;
    }

    const slotDateTime = slot.dateHeure;
    this.selectedDateTime.set(slotDateTime);
  }

  protected updateAppointmentAddress(value: string): void {
    const address = this.normalizeText(value);
    this.appointmentLocation.set(null);

    if (this.appointmentFor() === 'ME') {
      this.appointmentAddressOverride.set(address);
      this.fieldErrors.update((errors) => {
        const next = { ...errors };
        delete next.selfAddress;
        return next;
      });
      return;
    }

    this.updateRelativePatient('address', address);
  }

  protected slotStatusLabel(slot: ReservationAvailabilitySlotView): string {
    if (slot.available) return 'Disponible';
    if (slot.status === 'RESERVED') return 'Deja reserve';
    if (new Date(slot.dateHeure).getTime() <= Date.now()) return 'Heure depassee';
    return slot.reason || 'Indisponible';
  }

  protected updateRelativePatient(field: keyof RelativePatientForm, value: string): void {
    this.relativePatient.update((form) => ({ ...form, [field]: value }));
    if (field === 'address') {
      this.appointmentLocation.set(null);
    }
    this.fieldErrors.update((errors) => {
      const next = { ...errors };
      delete next[field];
      return next;
    });
  }

  protected useCurrentLocationForAppointment(): void {
    if (!navigator.geolocation) {
      this.feedback.info('La geolocalisation nest pas disponible sur cet appareil.');
      return;
    }

    this.isLocatingAddress.set(true);
    this.feedback.info('Autorisez le partage de votre position pour renseigner le lieu exact du rendez-vous.');

    let bestPosition: GeolocationPosition | null = null;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let watchId: number | null = null;

    const stopWatching = () => {
      if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
        watchId = null;
      }
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
    };

    const completeWithBestPosition = () => {
      stopWatching();
      if (!bestPosition) {
        this.isLocatingAddress.set(false);
        this.feedback.error('Position introuvable. Autorisez la geolocalisation puis reessayez.');
        return;
      }

      void this.applyGpsPosition(bestPosition);
    };

    watchId = navigator.geolocation.watchPosition(
      (position) => {
        const currentAccuracy = this.normalizeAccuracy(position.coords.accuracy);
        const bestAccuracy = bestPosition
          ? this.normalizeAccuracy(bestPosition.coords.accuracy)
          : Number.POSITIVE_INFINITY;

        if (!bestPosition || currentAccuracy < bestAccuracy) {
          bestPosition = position;
        }

        if (currentAccuracy <= IDEAL_GPS_ACCURACY_METERS) {
          completeWithBestPosition();
        }
      },
      (error) => {
        stopWatching();
        this.isLocatingAddress.set(false);
        if (error.code === error.PERMISSION_DENIED) {
          this.feedback.error('Autorisez la geolocalisation dans votre navigateur pour pointer le rendez-vous.');
          return;
        }
        this.feedback.error('Impossible de recuperer votre position. Verifiez que le GPS est active.');
      },
      {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: GPS_COLLECTION_TIMEOUT_MS,
      },
    );

    timeoutId = setTimeout(completeWithBestPosition, GPS_COLLECTION_TIMEOUT_MS);
  }

  protected confirmAppointment(): void {
    if (!this.authSession.hasAuthenticatedSession()) {
      this.feedback.info('Connectez-vous d abord pour confirmer ce rendez-vous.');
      this.router.navigate(['/auth/login'], {
        queryParams: { returnUrl: this.router.url },
      });
      return;
    }

    const detail = this.detail();
    const service = this.selectedService();
    const dateHeure = this.selectedDateTime();
    if (!detail || !service || !dateHeure) {
      this.feedback.info('Selectionnez un motif et un creneau disponible.');
      return;
    }

    const patientDraft = this.buildPatientDraft();
    if (!patientDraft) {
      this.feedback.info('Completez les informations du patient avant de confirmer.');
      return;
    }

    this.isSubmitting.set(true);
    this.proposalService
      .createDirectReservation({
        professionnelId: detail.profile.id,
        serviceId: service.id,
        dateHeure,
        adresseClient: patientDraft.adresseClient,
        dureeMinutes: service.dureeMinutes ?? 15,
        notes: patientDraft.notes,
      })
      .pipe(finalize(() => this.isSubmitting.set(false)))
      .subscribe({
        next: (reservation) => {
          const created = reservation as { id?: string };
          this.feedback.success('Rendez-vous cree avec succes.');
          if (created.id) {
            this.router.navigate(['/medecine', 'reservations', created.id, 'resume-paiement'], {
              queryParams: { source: 'medecine' },
            });
          } else {
            this.router.navigate(['/appointments']);
          }
        },
        error: (error) =>
          this.feedback.error(getHttpErrorMessage(error, 'Creation du rendez-vous impossible.')),
      });
  }

  protected serviceLabel(service: BackendProfessionalDetailService): string {
    return `${service.nom} - ${service.dureeMinutes ?? 15} min - ${Number(service.prix).toLocaleString('fr-FR')} FCFA`;
  }

  protected patientSummaryName(): string {
    if (this.appointmentFor() === 'ME') return this.userName();
    return this.normalizeText(this.relativePatient().fullName) || 'Patient a renseigner';
  }

  protected patientSummaryAddress(): string {
    if (this.appointmentFor() === 'ME') {
      return this.appointmentAddressOverride() || this.userAddress() || 'Adresse a ajouter au profil';
    }
    return this.normalizeText(this.relativePatient().address) || 'Adresse du proche a renseigner';
  }

  protected selectedServiceSummary(): string {
    const service = this.selectedService();
    if (!service) return 'Selectionnez un motif de consultation...';
    return `${service.nom} - ${service.dureeMinutes ?? 15} min`;
  }

  protected stepStatus(step: BookingStep): 'active' | 'done' | 'pending' {
    if (this.activeStep() === step) return 'active';
    if (step === 'PERSONAL' && this.activeStep() === 'RESERVATION') return 'done';
    return 'pending';
  }

  private validatePersonalStep(): boolean {
    if (this.appointmentFor() === 'ME') {
      const address = this.normalizeText(this.appointmentAddressOverride() || this.userAddress());
      if (address.length < 5) {
        this.fieldErrors.set({
          selfAddress: 'Ajoutez une adresse complete avant de continuer.',
        });
        return false;
      }

      this.fieldErrors.set({});
      return true;
    }

    const validation = this.validateRelativePatient();
    return validation.valid;
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
            user: this.authSession.hasAuthenticatedSession()
              ? this.authService.myUserProfile().pipe(catchError(() => of(null)))
              : of(null),
          }),
        ),
        finalize(() => this.isLoading.set(false)),
      )
      .subscribe({
        next: ({ detail, user }) => {
          this.detail.set(detail);
          this.user.set(user);
          const firstService = this.services()[0];
          if (firstService && !this.selectedServiceId()) {
            this.selectedServiceId.set(firstService.id);
          }
          const days = this.buildCalendarDays(21);
          this.calendarDays.set(days);
          const todayIso = this.toIsoDate(new Date());
          this.selectedDateIso.set(days.find((day) => day.isoDate === todayIso)?.isoDate ?? days[0]?.isoDate ?? '');
          this.loadAvailabilityForSelectedDate();
        },
        error: (error) =>
          this.errorMessage.set(getHttpErrorMessage(error, 'Impossible de charger ce medecin.')),
      });
  }

  private loadAvailabilityForSelectedDate(): void {
    const detail = this.detail();
    const service = this.selectedService();
    const selectedDate = this.selectedDateIso();
    if (!detail || !service || !selectedDate) return;

    this.isLoadingSlots.set(true);
    this.proposalService
      .listReservationAvailabilitySlots({
        professionalId: detail.profile.id,
        date: selectedDate,
        dureeMinutes: service.dureeMinutes ?? 15,
      })
      .pipe(finalize(() => this.isLoadingSlots.set(false)))
      .subscribe({
        next: (result) => this.selectedDateSlots.set(result.slots ?? []),
        error: () => {
          this.selectedDateSlots.set([]);
          this.feedback.error('Impossible de charger les creneaux de cette date.');
        },
      });
  }

  private buildCalendarDays(count: number): CalendarDay[] {
    const weekdayFormatter = new Intl.DateTimeFormat('fr-FR', { weekday: 'short' });
    const monthFormatter = new Intl.DateTimeFormat('fr-FR', { month: 'short' });
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const days: CalendarDay[] = [];
    const cursor = new Date(today);
    const mondayOffset = (cursor.getDay() + 6) % 7;
    cursor.setDate(cursor.getDate() - mondayOffset);

    while (days.length < count) {
      const date = new Date(cursor);
      date.setHours(0, 0, 0, 0);
      days.push({
        date,
        isoDate: this.toIsoDate(date),
        weekdayLabel: weekdayFormatter.format(date).replace('.', ''),
        dayNumber: date.getDate().toString().padStart(2, '0'),
        monthLabel: monthFormatter.format(date).replace('.', ''),
        isToday: date.getTime() === today.getTime(),
        isPast: date.getTime() < today.getTime(),
      });
      cursor.setDate(cursor.getDate() + 1);
    }

    return days;
  }

  private buildPatientDraft(): { adresseClient: string; notes: string } | null {
    if (this.appointmentFor() === 'ME') {
      const address = this.normalizeText(this.appointmentAddressOverride() || this.userAddress());
      if (address.length < 5) {
        this.fieldErrors.set({
          selfAddress: 'Ajoutez une adresse complete dans vos parametres avant de continuer.',
        });
        return null;
      }

      this.fieldErrors.set({});
      return {
        adresseClient: address,
        notes: this.limitNotes(
          [
            'Rendez-vous medical pris depuis l espace medecine.',
            `Patient: ${this.userName()}.`,
            `Telephone: ${this.userPhone()}.`,
            this.formatLocationNote(),
          ].join(' '),
        ),
      };
    }

    const validation = this.validateRelativePatient();
    if (!validation.valid) {
      this.fieldErrors.set(validation.errors);
      return null;
    }

    this.fieldErrors.set({});
    const patient = validation.patient;
    return {
      adresseClient: patient.address,
      notes: this.limitNotes(
        [
          'Rendez-vous medical pris pour un proche depuis l espace medecine.',
          `Patient: ${patient.fullName}.`,
          `Lien: ${patient.relationship}.`,
          `Telephone: ${patient.phoneNumber}.`,
          this.formatLocationNote(),
          patient.notes ? `Notes patient: ${patient.notes}.` : '',
        ]
          .filter(Boolean)
          .join(' '),
      ),
    };
  }

  private validateRelativePatient(
    includeErrors = true,
  ):
    | { valid: true; patient: Required<RelativePatientForm> }
    | { valid: false; errors: Partial<Record<PatientFormField, string>> } {
    const raw = this.relativePatient();
    const patient = {
      fullName: this.normalizeText(raw.fullName),
      phoneNumber: normalizeSenegalPhoneNumber(raw.phoneNumber),
      relationship: this.normalizeText(raw.relationship),
      address: this.normalizeText(raw.address),
      notes: this.normalizeText(raw.notes),
    };
    const errors: Partial<Record<PatientFormField, string>> = {};

    if (patient.fullName.length < 2) {
      errors.fullName = 'Renseignez le nom complet du patient.';
    }

    if (!new RegExp(SENEGAL_PHONE_PATTERN).test(patient.phoneNumber)) {
      errors.phoneNumber = 'Renseignez un numero senegalais valide.';
    }

    if (patient.relationship.length < 2) {
      errors.relationship = 'Precisez le lien avec le patient.';
    }

    if (patient.address.length < 5) {
      errors.address = 'Renseignez une adresse complete pour le rendez-vous.';
    }

    if (patient.notes.length > 500) {
      errors.notes = 'Les notes patient ne doivent pas depasser 500 caracteres.';
    }

    if (Object.keys(errors).length > 0) {
      if (includeErrors) this.fieldErrors.set(errors);
      return { valid: false, errors };
    }

    return {
      valid: true,
      patient,
    };
  }

  private normalizeText(value: string): string {
    return value.trim().replace(/\s+/g, ' ');
  }

  private initials(name: string): string {
    return name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join('')
      .toUpperCase();
  }

  private limitNotes(value: string): string {
    return value.length <= 1000 ? value : value.slice(0, 997).trimEnd() + '...';
  }

  private formatLocationNote(): string {
    const location = this.appointmentLocation();
    if (!location) return '';

    const accuracy = location.accuracyMeters === null
      ? ''
      : ` Precision GPS: ${Math.round(location.accuracyMeters)} metres.`;
    return `Localisation exacte (${location.source}): ${location.latitude}, ${location.longitude}.${accuracy} Adresse selectionnee: ${location.label}.`;
  }

  private async resolveAddressLabelFromCoordinates(
    latitude: number,
    longitude: number,
    fallbackLabel: string,
  ): Promise<string> {
    try {
      const result = await firstValueFrom(
        this.googleMaps.reverseGeocode({ latitude, longitude }),
      );
      return result?.formattedAddress || fallbackLabel;
    } catch {
      return fallbackLabel;
    }
  }

  private async applyGpsPosition(position: GeolocationPosition): Promise<void> {
    const latitude = position.coords.latitude;
    const longitude = position.coords.longitude;
    const accuracyMeters = this.normalizeAccuracy(position.coords.accuracy);

    if (accuracyMeters > MAX_ACCEPTED_GPS_ACCURACY_METERS) {
      this.isLocatingAddress.set(false);
      this.feedback.error(
        `Position encore trop imprecise (${Math.round(accuracyMeters)} m). Activez le GPS precis de votre appareil puis reessayez.`,
      );
      return;
    }

    const fallbackLabel = `Position GPS precise: ${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
    const label = await this.resolveAddressLabelFromCoordinates(latitude, longitude, fallbackLabel);
    this.isLocatingAddress.set(false);

    if (this.appointmentFor() === 'ME') {
      this.appointmentAddressOverride.set(label);
    } else {
      this.updateRelativePatient('address', label);
    }

    this.appointmentLocation.set({
      label,
      latitude,
      longitude,
      accuracyMeters: Number.isFinite(accuracyMeters) ? accuracyMeters : null,
      source: 'GPS',
    });

    this.feedback.success('Position exacte ajoutee au rendez-vous.');
  }

  private normalizeAccuracy(value: number | null | undefined): number {
    return typeof value === 'number' && Number.isFinite(value)
      ? value
      : Number.POSITIVE_INFINITY;
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
