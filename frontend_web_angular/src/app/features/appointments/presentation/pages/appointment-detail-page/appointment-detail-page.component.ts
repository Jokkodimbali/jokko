import { CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { Subscription, catchError, firstValueFrom, merge, of, switchMap, timer } from 'rxjs';
import { AuthSessionService } from '../../../../../core/auth/auth-session.service';
import { AppFeedbackService } from '../../../../../core/feedback/app-feedback.service';
import { BackNavigationService } from '../../../../../core/navigation/back-navigation.service';
import { userInitials } from '../../../../../shared/utils/user-initials';
import { getHttpErrorMessage } from '../../../../../core/http/api-response.utils';
import { MessagesService } from '../../../../messages/data-access/messages.service';
import { AppointmentsService } from '../../../data-access/appointments.service';
import { AppointmentTrackingView, AppointmentView } from '../../../domain/appointments.models';
import { AppointmentDetailLoadingComponent } from '../../components/appointment-detail-loading/appointment-detail-loading.component';
import {
  AppointmentTrackingStep,
  AppointmentTrackingStepperComponent,
} from '../../components/appointment-tracking-stepper/appointment-tracking-stepper.component';
import { ProviderLocationService } from '../../../../tracking/data-access/provider-location.service';
import { TrackingRealtimeService } from '../../../../tracking/data-access/tracking-realtime.service';
import { TrackingGoogleMapRendererService } from '../../../../tracking/presentation/tracking-google-map-renderer.service';
import { TrackingStore } from '../../../../tracking/state/tracking.store';

type MapCoordinate = { lat: number; lng: number };
type RouteAlternativeView = {
  id: string;
  label: string;
  distanceLabel: string;
  durationLabel: string;
  isSelected: boolean;
};
type RouteOption = {
  id: string;
  coordinates: Array<[number, number]>;
  distanceKm: number | null;
  durationMinutes: number | null;
  navigationSteps: RouteNavigationStep[];
};
type RouteNavigationStep = {
  id: string;
  instruction: string;
  maneuver: string | null;
  distanceMeters: number | null;
  end: MapCoordinate | null;
};
type TrackingStepView = AppointmentTrackingStep;
type MedicalRecordKind = 'act' | 'vaccine' | 'treatment';

const COMMON_MEDICAL_ACTS = [
  'Consultation de medecine generale',
  'Auscultation cardiopulmonaire',
  'Prise de tension et saturation',
  'Electrocardiogramme (ECG)',
  'Test de depistage grippe/covid',
  'Suture de plaie simple',
] as const;
const COMMON_VACCINES = [
  'Vaxigrip Tetra (Grippe)',
  'Repevax (DTP-Coq)',
  'Comirnaty (Covid-19)',
  'Engerix B (Hepatite B)',
] as const;
const COMMON_TREATMENTS = [
  'Paracetamol 1g - 1 comprime toutes les 6 heures si fievre, maximum 4g par jour',
  'Ibuprofene 400mg - 1 comprime toutes les 8 heures au milieu des repas',
  'Amoxicilline 1g - 1 comprime matin et soir pendant 6 jours',
  'Sirop antitussif - 1 cuillere a soupe 3 fois par jour',
  'Repos strict a domicile pendant 5 jours',
] as const;
const SENEGAL_GEO_BOUNDS = {
  minLat: 12,
  maxLat: 17.2,
  minLng: -18.7,
  maxLng: -11,
} as const;
const ARRIVAL_DISTANCE_THRESHOLD_METERS = 120;
const TRACKING_FALLBACK_POLL_INTERVAL_MS = 30000;
const APPOINTMENT_STATE_FALLBACK_INITIAL_DELAY_MS = 15000;
const APPOINTMENT_STATE_FALLBACK_INTERVAL_MS = 30000;

type AppointmentDetailUiState =
  | 'loading'
  | 'error'
  | 'client-summary'
  | 'completed'
  | 'closed'
  | 'working'
  | 'route'
  | 'upcoming';
type AppointmentStatus = AppointmentView['status'];

const CLOSED_APPOINTMENT_STATUSES: ReadonlySet<AppointmentStatus> = new Set([
  'ANNULEE',
  'NO_SHOW',
  'LITIGE',
]);
const TERMINAL_APPOINTMENT_STATUSES: ReadonlySet<AppointmentStatus> = new Set([
  'TERMINEE',
  ...CLOSED_APPOINTMENT_STATUSES,
]);
const LIVE_TRACKING_STATUSES: ReadonlySet<AppointmentStatus> = new Set([
  'PAYEE_SEQUESTRE',
  'EN_COURS',
]);

@Component({
  selector: 'app-appointment-detail-page',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    LucideAngularModule,
    AppointmentDetailLoadingComponent,
    AppointmentTrackingStepperComponent,
  ],
  templateUrl: './appointment-detail-page.component.html',
  styleUrls: [
    './appointment-detail-page.component.scss',
    './appointment-detail-upcoming.component.scss',
    './appointment-detail-tracking.component.scss',
    './appointment-detail-map.component.scss',
    './appointment-detail-responsive.component.scss',
  ],
  providers: [TrackingStore, TrackingGoogleMapRendererService],
})
export class AppointmentDetailPageComponent implements AfterViewInit, OnDestroy, OnInit {
  @ViewChild('trackingMap')
  set trackingMapRef(value: ElementRef<HTMLElement> | undefined) {
    if (!value) {
      this.destroyRouteMap();
      return;
    }

    this.trackingMapElement = value?.nativeElement;
    window.setTimeout(() => void this.initializeGoogleMaps(), 0);
  }

  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly appointmentsService = inject(AppointmentsService);
  private readonly messagesService = inject(MessagesService);
  private readonly feedback = inject(AppFeedbackService);
  private readonly backNavigation = inject(BackNavigationService);
  private readonly authSession = inject(AuthSessionService);
  private readonly trackingRealtime = inject(TrackingRealtimeService);
  private readonly providerLocation = inject(ProviderLocationService);
  private readonly trackingStore = inject(TrackingStore);
  private readonly mapRenderer = inject(TrackingGoogleMapRendererService);
  private trackingSubscription?: Subscription;
  private missionSubscription?: Subscription;
  private connectionSubscription?: Subscription;
  private appointmentStatePollingSubscription?: Subscription;
  private providerLocationSubscription?: Subscription;
  private elapsedClockInterval?: number;
  private routeCoordinates: Array<[number, number]> = [];
  private routeOptions: RouteOption[] = [];
  private routeCoordinatesKey = '';
  private trackingMapElement?: HTMLElement;
  private lastSpokenNavigationKey = '';

  protected readonly currentUser = this.authSession.currentUser;
  protected readonly appointment = signal<AppointmentView | null>(null);
  protected readonly tracking = this.trackingStore.tracking;
  protected readonly isLoading = signal(true);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly alertEnabled = signal(false);
  protected readonly isUpdatingStatus = signal(false);
  protected readonly nowMs = signal(Date.now());
  protected readonly isHandlingPriceAdjustment = signal(false);
  protected readonly isRescheduleModalOpen = signal(false);
  protected readonly isPriceAdjustmentModalOpen = signal(false);
  protected readonly rescheduleDateTime = signal('');
  protected readonly priceAdjustmentForm = {
    proposedPrice: 0,
    reason: '',
  };
  protected readonly isSubmittingReview = signal(false);
  protected readonly destinationCoordinates = signal<MapCoordinate | null>(null);
  protected readonly routeDistanceKm = signal<number | null>(null);
  protected readonly routeDurationMinutes = signal<number | null>(null);
  protected readonly routeStatus = signal<'idle' | 'calculating' | 'ready' | 'unavailable'>('idle');
  protected readonly isSatelliteMapEnabled = signal(false);
  protected readonly isMapFullscreen = signal(false);
  protected readonly isNavigationVoiceEnabled = signal(true);
  protected readonly mapHeadingDegrees = signal(0);
  protected readonly selectedRouteId = signal('route-0');
  protected readonly routeAlternatives = signal<RouteAlternativeView[]>([]);
  protected readonly medicalActs = signal<string[]>([COMMON_MEDICAL_ACTS[0]]);
  protected readonly medicalVaccines = signal<string[]>([]);
  protected readonly medicalTreatments = signal<string[]>([]);
  protected readonly currentMedicalAct = signal('');
  protected readonly currentMedicalVaccine = signal('');
  protected readonly currentMedicalTreatment = signal('');
  protected readonly isPrescriptionPreviewOpen = signal(false);
  protected readonly commonMedicalActs = COMMON_MEDICAL_ACTS;
  protected readonly commonVaccines = COMMON_VACCINES;
  protected readonly commonTreatments = COMMON_TREATMENTS;
  protected readonly destinationStatus = signal<'idle' | 'resolving' | 'ready' | 'unavailable'>(
    'idle',
  );
  protected readonly selectedRating = signal(0);
  protected readonly reviewStars = [1, 2, 3, 4, 5];
  protected readonly hasPendingPriceAdjustment = computed(() => {
    const appointment = this.appointment();
    return (
      appointment?.priceAdjustmentStatus === 'EN_ATTENTE_CLIENT' &&
      typeof appointment.proposedAdjustedPrice === 'number' &&
      Number.isFinite(appointment.proposedAdjustedPrice)
    );
  });
  protected readonly isProviderViewer = computed(() => {
    return this.isProfessionalRole(this.currentUser()?.role);
  });
  protected readonly isDoctorViewer = computed(() => this.currentUser()?.role === 'MEDECIN');
  protected readonly canManageProviderStatus = computed(() => {
    const appointment = this.appointment();
    return (
      this.isProfessionalRole(this.currentUser()?.role) &&
      !!appointment &&
      !this.isTerminalAppointmentStatus(appointment.status)
    );
  });
  protected readonly canCancelAppointment = computed(() => {
    const status = this.appointment()?.status;
    return !!status && !this.isTerminalAppointmentStatus(status);
  });
  protected readonly minRescheduleDateTime = computed(() =>
    this.toDateTimeLocalValue(new Date(Date.now() + 15 * 60 * 1000)),
  );
  protected readonly isAppointmentCompleted = computed(
    () => this.appointment()?.status === 'TERMINEE',
  );
  protected readonly isAppointmentClosed = computed(() => {
    const status = this.appointment()?.status;
    return !!status && this.isClosedAppointmentStatus(status);
  });
  protected readonly isDisputedAppointment = computed(
    () => this.appointment()?.status === 'LITIGE',
  );
  protected readonly closedStatusLabel = computed(() => {
    const status = this.appointment()?.status;
    if (status === 'ANNULEE') return 'Rendez-vous annule';
    if (status === 'NO_SHOW') return 'Client absent';
    if (status === 'LITIGE') return 'Rendez-vous en litige';
    return 'Rendez-vous cloture';
  });
  protected readonly closedStatusDescription = computed(() => {
    const status = this.appointment()?.status;
    if (status === 'ANNULEE') {
      return 'Le suivi de localisation et les instructions de navigation sont arretes.';
    }
    if (status === 'NO_SHOW') {
      return 'La mission est cloturee sans prestation. Aucun suivi GPS ne reste actif.';
    }
    if (status === 'LITIGE') {
      return 'Le suivi est suspendu pendant le traitement du litige.';
    }
    return 'Le suivi temps reel est arrete.';
  });
  protected readonly currentPriceLabel = computed(() =>
    this.formatCurrency(this.appointment()?.agreedPrice ?? 0),
  );
  protected readonly finalPriceLabel = computed(() => {
    const appointment = this.appointment();
    return this.formatCurrency(appointment?.proposedAdjustedPrice ?? appointment?.agreedPrice ?? 0);
  });
  protected readonly finalPriceAmount = computed(() => {
    const appointment = this.appointment();
    return appointment?.proposedAdjustedPrice ?? appointment?.agreedPrice ?? 0;
  });
  protected readonly medicalTotalAmount = computed(() => {
    const base = this.finalPriceAmount();
    const extraActs = Math.max(0, this.medicalActs().length - 1) * 5000;
    const vaccines = this.medicalVaccines().length * 3000;
    return base + extraActs + vaccines;
  });
  protected readonly medicalTotalLabel = computed(() =>
    this.formatCurrency(this.medicalTotalAmount()),
  );
  protected readonly invoiceNumberLabel = computed(() => {
    const appointmentId = this.appointment()?.id ?? '';
    const suffix = appointmentId.replace(/-/g, '').slice(-4).toUpperCase();
    return `Facture Numero ${suffix || '----'}`;
  });
  protected readonly invoiceCodeLabel = computed(() => {
    const compact = (this.appointment()?.id ?? '').replace(/-/g, '').toUpperCase();
    return `#FCT-${compact.slice(0, 4) || '----'}-${compact.slice(-4) || '----'}`;
  });
  protected readonly completedAtLabel = computed(() => {
    const tracking = this.tracking();
    const appointment = this.appointment();
    return this.formatTimeFromValue(
      tracking?.endedAt ||
        tracking?.updatedAt ||
        tracking?.lastPositionAt ||
        appointment?.scheduledAt,
    );
  });
  protected readonly completedPaymentLabel = computed(() => {
    const tracking = this.tracking();
    const appointment = this.appointment();
    return `Paiement confirme le ${this.formatLongDateTime(
      tracking?.endedAt ||
        tracking?.updatedAt ||
        tracking?.lastPositionAt ||
        appointment?.scheduledAt,
    )}`;
  });
  protected readonly realDurationLabel = computed(() => {
    const tracking = this.tracking();
    const appointment = this.appointment();
    const startedAt = tracking?.startedAt ? new Date(tracking.startedAt) : null;
    const endedAt = tracking?.endedAt ? new Date(tracking.endedAt) : null;

    if (
      startedAt &&
      endedAt &&
      !Number.isNaN(startedAt.getTime()) &&
      !Number.isNaN(endedAt.getTime()) &&
      endedAt.getTime() > startedAt.getTime()
    ) {
      return `${Math.max(1, Math.round((endedAt.getTime() - startedAt.getTime()) / 60000))} min.`;
    }

    return `${appointment?.durationMinutes || 30} min.`;
  });
  protected readonly proposedAdjustedPriceLabel = computed(() =>
    this.formatCurrency(this.appointment()?.proposedAdjustedPrice ?? 0),
  );
  protected readonly priceAdjustmentDeltaLabel = computed(() => {
    const appointment = this.appointment();
    const currentPrice = appointment?.agreedPrice ?? 0;
    const proposedPrice = appointment?.proposedAdjustedPrice ?? 0;
    const delta = proposedPrice - currentPrice;
    const sign = delta >= 0 ? '+' : '-';
    return `${sign} ${this.formatCurrency(Math.abs(delta))}`;
  });
  protected readonly isProviderWorking = computed(() => {
    const appointment = this.appointment();
    if (!appointment || this.isAppointmentCompleted() || !this.canShowLiveTracking(appointment)) {
      return false;
    }

    const tracking = this.tracking();
    return tracking?.presence.status === 'EN_PRESTATION' || appointment.status === 'EN_COURS';
  });
  protected readonly isProviderOnTheWay = computed(() => {
    const appointment = this.appointment();
    if (!appointment || this.isAppointmentCompleted() || !this.canShowLiveTracking(appointment)) {
      return false;
    }

    const tracking = this.tracking();
    return (
      !this.isProviderWorking() &&
      (tracking?.trackingStatus === 'EN_ROUTE' || tracking?.presence.status === 'EN_ROUTE')
    );
  });
  protected readonly canShowProviderStartAction = computed(
    () =>
      this.isProviderViewer() &&
      !this.isRouteActorViewer() &&
      !this.isProviderWorking() &&
      (this.isProviderOnTheWay() || this.hasTravelerArrivalConfirmation()),
  );
  protected readonly isOperationalServiceDay = computed(() => {
    const appointment = this.appointment();
    return (
      !!appointment &&
      !this.isAppointmentCompleted() &&
      !this.isAppointmentClosed() &&
      this.canShowLiveTracking(appointment) &&
      this.isServiceDay(appointment) &&
      (appointment.status === 'PAYEE_SEQUESTRE' || appointment.status === 'EN_COURS')
    );
  });
  protected readonly shouldShowOperationalMap = computed(
    () =>
      this.isProviderOnTheWay() ||
      this.isProviderWorking() ||
      this.isOperationalServiceDay(),
  );
  protected readonly hasActiveTrackingNavigation = computed(
    () =>
      this.appointment()?.status === 'EN_COURS' ||
      this.tracking()?.trackingStatus === 'EN_ROUTE',
  );
  protected readonly providerTravelsToClient = computed(
    () => this.appointment()?.travelMode !== 'CLIENT_SE_DEPLACE',
  );
  protected readonly clientTravelsToProvider = computed(
    () => this.appointment()?.travelMode === 'CLIENT_SE_DEPLACE',
  );
  protected readonly isRouteActorViewer = computed(() =>
    this.clientTravelsToProvider() ? !this.isProviderViewer() : this.isProviderViewer(),
  );
  protected readonly trackedTravelerName = computed(() => {
    const appointment = this.appointment();
    if (!appointment) return 'Le participant';
    return this.clientTravelsToProvider()
      ? appointment.clientName || 'Le client'
      : appointment.doctorName || 'Le prestataire';
  });
  protected readonly trackedTravelerRoleLabel = computed(() =>
    this.clientTravelsToProvider() ? 'client' : 'prestataire',
  );
  protected readonly statusLabel = computed(() => {
    if (this.isAppointmentCompleted()) return 'Prestation terminee';
    if (this.isProviderWorking()) return 'Prestation en cours';
    if (this.isProviderOnTheWay()) return 'Prestation en route';
    const status = this.appointment()?.status;
    return status === 'ANNULEE' ? 'Rendez-vous annule' : 'Prestation prevus';
  });
  protected readonly trackingLatitude = computed(
    () => this.tracking()?.lastLatitude ?? this.tracking()?.presence.lastLatitude ?? null,
  );
  protected readonly trackingLongitude = computed(
    () => this.tracking()?.lastLongitude ?? this.tracking()?.presence.lastLongitude ?? null,
  );
  protected readonly hasTrackingCoordinates = computed(
    () => {
      const latitude = this.trackingLatitude();
      const longitude = this.trackingLongitude();
      return (
        typeof latitude === 'number' &&
        typeof longitude === 'number' &&
        this.isCoordinateInSenegal(latitude, longitude)
      );
    },
  );
  protected readonly canStartRouteToday = computed(() => {
    const appointment = this.appointment();
    return !!appointment && this.isServiceDay(appointment);
  });
  protected readonly canProviderMarkOnTheWay = computed(() => {
    const appointment = this.appointment();
    return (
      !!appointment &&
      this.canManageProviderStatus() &&
      appointment.status === 'PAYEE_SEQUESTRE' &&
      this.providerTravelsToClient() &&
      !this.isProviderOnTheWay() &&
      !this.isProviderWorking() &&
      this.canStartRouteToday()
    );
  });
  protected readonly canMarkTravelerOnTheWay = computed(() => {
    const appointment = this.appointment();
    return (
      !!appointment &&
      appointment.status === 'PAYEE_SEQUESTRE' &&
      this.canStartRouteToday() &&
      this.isRouteActorViewer() &&
      !this.isProviderOnTheWay() &&
      !this.isProviderWorking()
    );
  });
  protected readonly canShareTravelerLocation = computed(
    () => this.isRouteActorViewer() && this.isProviderOnTheWay() && !this.isProviderWorking(),
  );
  protected readonly hasTravelerArrivalConfirmation = computed(
    () => this.clientTravelsToProvider() && this.trackingIndicatesArrival(this.tracking()),
  );
  protected readonly hasTravelerArrivedAtDestination = computed(() => {
    if (this.isProviderWorking()) return true;
    if (this.hasTravelerArrivalConfirmation()) return true;
    if (!this.isProviderOnTheWay()) return false;

    const serverDistance = this.tracking()?.route?.distanceRemainingMeters;
    if (typeof serverDistance === 'number') {
      return serverDistance <= ARRIVAL_DISTANCE_THRESHOLD_METERS;
    }

    const destination = this.destinationCoordinates();
    if (destination) {
      return (
        this.distanceMetersBetweenCurrentPosition(destination) <=
        ARRIVAL_DISTANCE_THRESHOLD_METERS
      );
    }

    const routeDistance = this.routeDistanceKm();
    return (
      routeDistance !== null &&
      routeDistance * 1000 <= ARRIVAL_DISTANCE_THRESHOLD_METERS
    );
  });
  protected readonly canProviderStartWork = computed(() => {
    const appointment = this.appointment();
    if (
      !appointment ||
      !this.canManageProviderStatus() ||
      appointment.status !== 'PAYEE_SEQUESTRE'
    ) {
      return false;
    }

    if (this.clientTravelsToProvider()) {
      return this.hasTravelerArrivedAtDestination();
    }

    return this.canStartRouteToday() && this.isProviderOnTheWay() && this.isRouteActorViewer();
  });
  protected readonly canTravelerMarkArrived = computed(() => {
    const appointment = this.appointment();
    return (
      !!appointment &&
      appointment.status === 'PAYEE_SEQUESTRE' &&
      this.isRouteActorViewer() &&
      this.isProviderOnTheWay() &&
      !this.isProviderWorking()
    );
  });
  protected readonly canProviderCompleteWork = computed(() => {
    const appointment = this.appointment();
    return (
      !!appointment &&
      this.canManageProviderStatus() &&
      (appointment.status === 'EN_COURS' || this.isProviderWorking())
    );
  });
  protected readonly canProviderMarkClientAbsent = computed(() => {
    const appointment = this.appointment();
    return (
      !!appointment &&
      this.canManageProviderStatus() &&
      !this.isAppointmentInFuture(appointment) &&
      (appointment.status === 'PAYEE_SEQUESTRE' || appointment.status === 'EN_COURS')
    );
  });
  protected readonly isPaymentRequired = computed(() => {
    const status = this.appointment()?.status;
    return status === 'CONFIRMEE';
  });
  protected readonly canClientPayAppointment = computed(() => {
    const appointment = this.appointment();
    return (
      !!appointment &&
      this.isPaymentRequired() &&
      !this.isProviderViewer() &&
      !this.isAppointmentClosed()
    );
  });
  protected readonly operationalStatusTitle = computed(() => {
    const status = this.appointment()?.status;
    if (status === 'PAYEE_SEQUESTRE') return 'Pret a demarrer';
    if (status === 'EN_COURS') return 'Prestation en cours';
    if (status === 'CONFIRMEE') return 'Paiement a finaliser';
    return 'Statut du rendez-vous';
  });
  protected readonly operationalStatusDescription = computed(() => {
    const status = this.appointment()?.status;
    if (status === 'PAYEE_SEQUESTRE') {
      return 'Le paiement est sequestre. Le prestataire peut activer le trajet puis commencer la prestation le jour du rendez-vous.';
    }
    if (status === 'EN_COURS') {
      return 'La prestation a demarre. Le prestataire peut la marquer comme terminee apres intervention.';
    }
    if (status === 'CONFIRMEE') {
      return this.isProviderViewer()
        ? 'Les actions demarrer et terminer sont bloquees tant que le client na pas finalise le paiement.'
        : 'Finalisez le paiement pour permettre au prestataire de demarrer puis terminer la prestation.';
    }
    return 'Consultez le statut avant de poursuivre les actions sur ce rendez-vous.';
  });
  protected readonly remainingDistanceLabel = computed(() => {
    if (!this.isProviderOnTheWay()) return 'Suivi inactif';
    const serverDistance = this.tracking()?.route?.distanceRemainingMeters;
    if (typeof serverDistance === 'number' && serverDistance > 0) {
      return `${this.formatDistance(serverDistance / 1000)} restants`;
    }
    const routeDistance = this.routeDistanceKm();
    if (routeDistance !== null && routeDistance > 0) {
      return `${this.formatDistance(routeDistance)} restants`;
    }
    if (!this.hasTrackingCoordinates()) {
      return 'Position reelle du prestataire en attente';
    }
    if (this.destinationStatus() !== 'ready') {
      return "Adresse d'intervention en cours de localisation";
    }
    if (this.routeStatus() === 'calculating') return "Calcul de l'itineraire en cours";
    return 'Itineraire routier indisponible';
  });
  protected readonly estimatedArrivalMinutes = computed(() => {
    const serverDuration = this.tracking()?.route?.durationRemainingSeconds;
    if (typeof serverDuration === 'number' && serverDuration > 0) {
      return Math.max(1, Math.round(serverDuration / 60));
    }
    const minutes = this.routeDurationMinutes();
    return minutes !== null && minutes > 0 ? minutes : 0;
  });
  protected readonly routeProgress = computed(() => {
    if (this.isProviderWorking()) return 100;
    const minutes = this.estimatedArrivalMinutes();
    if (minutes <= 0) return 0;
    return Math.max(18, Math.min(82, 100 - minutes * 4));
  });
  protected readonly routeProgressLabel = computed(() => `${this.routeProgress()}%`);
  protected readonly trackingCurrentStepIndex = computed(() => {
    if (this.isAppointmentCompleted()) return 3;
    if (this.isProviderWorking() || this.appointment()?.status === 'EN_COURS') return 2;
    if (this.isProviderOnTheWay() || this.tracking()?.trackingStatus === 'EN_ROUTE') return 1;
    return 0;
  });
  protected readonly trackingStepProgress = computed(() =>
    Math.round((this.trackingCurrentStepIndex() / 3) * 100),
  );
  protected readonly trackingTimelineSteps = computed<TrackingStepView[]>(() => {
    const activeIndex = this.trackingCurrentStepIndex();
    const steps = [
      {
        label: 'Confirme',
        description: 'Reservation validee',
        icon: 'calendar-days',
      },
      {
        label: 'En route',
        description: `${this.trackedTravelerName()} se deplace`,
        icon: 'send',
      },
      {
        label: 'Travaux',
        description: 'Prestation en cours',
        icon: 'wrench',
      },
      {
        label: 'Termine',
        description: 'Mission cloturee',
        icon: 'check',
      },
    ];

    return steps.map((step, index) => ({
      ...step,
      state: index < activeIndex ? 'done' : index === activeIndex ? 'active' : 'pending',
    }));
  });
  protected readonly providerTrackingCurrentStepIndex = computed(() => {
    if (this.isAppointmentCompleted()) return 3;
    if (this.isProviderWorking() || this.appointment()?.status === 'EN_COURS') return 2;
    if (this.isProviderOnTheWay() || this.tracking()?.trackingStatus === 'EN_ROUTE') return 1;
    return 0;
  });
  protected readonly providerTrackingStepProgress = computed(() =>
    Math.round((this.providerTrackingCurrentStepIndex() / 3) * 100),
  );
  protected readonly providerTrackingTimelineSteps = computed<TrackingStepView[]>(() => {
    const activeIndex = this.providerTrackingCurrentStepIndex();
    const interventionLabel = this.isDoctorViewer() ? 'Consultation' : 'Intervention';
    const interventionDescription = this.isDoctorViewer()
      ? 'Soins en cours'
      : 'Travaux en cours';
    const interventionIcon = this.isDoctorViewer() ? 'stethoscope' : 'clock-3';
    const steps = [
      { label: 'A venir', description: 'Mission planifiee', icon: 'briefcase-business' },
      { label: 'Trajet', description: 'Navigation active', icon: 'send' },
      { label: interventionLabel, description: interventionDescription, icon: interventionIcon },
      { label: 'Cloture', description: 'Mission terminee', icon: 'check' },
    ];

    return steps.map((step, index) => ({
      ...step,
      state: index < activeIndex ? 'done' : index === activeIndex ? 'active' : 'pending',
    }));
  });
  protected readonly providerConsoleEyebrow = computed(() => {
    if (this.isAppointmentCompleted()) return 'Mission cloturee';
    if (this.isProviderWorking()) return 'Temps de travail ecoule';
    if (this.isProviderOnTheWay()) return `Navigation vers ${this.clientFirstNameLabel()}`;
    return this.clientTravelsToProvider() ? 'Arrivee client attendue' : 'Arrivee client souhaitee';
  });
  protected readonly providerConsoleTitle = computed(() => {
    const appointment = this.appointment();
    if (this.isAppointmentCompleted()) return 'Mission terminee';
    if (this.isProviderWorking()) return this.providerElapsedWorkLabel();
    if (this.isProviderOnTheWay()) return this.routeEtaLabel();
    return appointment?.timeLabel ?? '--h--';
  });
  protected readonly providerConsoleDescription = computed(() => {
    if (this.isAppointmentCompleted()) {
      return `${this.finalPriceLabel()} a ete declenche. Le client recevra sa facture PDF immediatement.`;
    }
    if (this.isProviderWorking()) {
      return this.appointment()?.serviceName ?? 'Intervention en cours';
    }
    if (this.isProviderOnTheWay()) {
      return this.navigationInstruction().instruction;
    }
    if (this.clientTravelsToProvider()) {
      return 'Le client doit partager sa position puis arriver a destination avant le demarrage.';
    }
    return 'Activez le trajet le jour du rendez-vous pour partager votre position au client.';
  });
  protected readonly providerElapsedWorkLabel = computed(() => {
    const appointment = this.appointment();
    if (!appointment) return '00:00:00';
    const tracking = this.tracking();
    const startedAt =
      tracking?.startedAt ||
      tracking?.updatedAt ||
      tracking?.lastPositionAt ||
      appointment.scheduledAt;
    const start = new Date(startedAt);
    if (Number.isNaN(start.getTime())) return '00:00:00';
    const elapsed = Math.max(0, this.nowMs() - start.getTime());
    const hours = Math.floor(elapsed / 3_600_000);
    const minutes = Math.floor((elapsed % 3_600_000) / 60_000);
    const seconds = Math.floor((elapsed % 60_000) / 1000);
    return `${hours.toString().padStart(2, '0')}:${minutes
      .toString()
      .padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  });
  protected readonly providerPrimaryActionLabel = computed(() => {
    if (this.isAppointmentCompleted()) return 'Voir le recapitulatif';
    if (this.isProviderWorking()) return "Cloturer l'intervention";
    if (this.clientTravelsToProvider() && this.hasTravelerArrivalConfirmation()) {
      return 'Commencer la prestation';
    }
    if (this.isProviderOnTheWay()) {
      if (this.clientTravelsToProvider()) {
        return this.hasTravelerArrivedAtDestination()
          ? 'Commencer la prestation'
          : 'Client en route';
      }
      return 'Je suis arrive sur place';
    }
    if (this.canMarkTravelerOnTheWay()) return 'Demarrer le trajet';
    return this.clientTravelsToProvider() ? 'En attente du client' : 'Trajet indisponible';
  });
  protected readonly canUseProviderPrimaryAction = computed(() => {
    if (this.isAppointmentCompleted()) return true;
    if (this.isProviderWorking()) return this.canProviderCompleteWork();
    if (
      this.isProviderOnTheWay() ||
      (this.clientTravelsToProvider() && this.hasTravelerArrivalConfirmation())
    ) {
      return this.canProviderStartWork();
    }
    return this.canMarkTravelerOnTheWay();
  });
  protected readonly providerPrimaryActionIcon = computed(() => {
    if (this.isAppointmentCompleted()) return 'receipt';
    if (this.isProviderWorking()) return 'check';
    if (
      this.isProviderOnTheWay() ||
      (this.clientTravelsToProvider() && this.hasTravelerArrivalConfirmation())
    ) {
      return 'map-pin';
    }
    return 'send';
  });
  protected readonly clientFirstNameLabel = computed(() => {
    const name = this.appointment()?.clientName?.trim();
    if (!name) return 'le client';
    return name.split(/\s+/)[0] || name;
  });
  protected readonly providerFirstNameLabel = computed(() => {
    const name = this.appointment()?.doctorName?.trim();
    if (!name) return 'Le professionnel';
    return name.split(/\s+/)[0] || name;
  });
  protected readonly providerRoleLabel = computed(() => {
    const appointment = this.appointment();
    const role =
      appointment?.specialty?.trim() ||
      appointment?.serviceName?.trim() ||
      'professionnel';
    return role.toLocaleLowerCase('fr-FR');
  });
  protected readonly clientTrackingTitle = computed(() => {
    if (this.isAppointmentCompleted()) return 'Termine';
    if (this.isProviderWorking()) return 'Travaux en cours';
    if (this.isProviderOnTheWay()) return 'En route vers vous';
    return 'Intervention confirmee';
  });
  protected readonly clientTrackingDescription = computed(() => {
    if (this.isAppointmentCompleted()) {
      return "L'intervention s'est deroulee avec succes. Tout est desormais parfaitement fonctionnel.";
    }
    if (this.isProviderWorking()) {
      return `L'intervention est en cours. Le ${this.providerRoleLabel()} repare actuellement votre installation.`;
    }
    if (this.isProviderOnTheWay()) {
      return `${this.providerFirstNameLabel()} est en deplacement. Il utilise l'itineraire le plus rapide pour arriver a l'heure.`;
    }
    return "Votre professionnel se prepare. L'heure de rendez-vous a ete bloquee dans son agenda.";
  });
  protected readonly routeRemainingBadgeLabel = computed(() => {
    if (this.isProviderWorking()) return 'Arrive';
    const distance = this.routeDistanceKm();
    const minutes = this.routeDurationMinutes();
    if (distance !== null && distance > 0) return this.formatDistance(distance);
    if (minutes !== null && minutes > 0) return `${minutes} min`;
    return 'GPS';
  });
  protected readonly routeEtaLabel = computed(() => {
    if (this.isProviderWorking()) return 'Arrive';
    const minutes = this.estimatedArrivalMinutes();
    return minutes > 0 ? `${minutes} min` : '-- min';
  });
  protected readonly lastPositionLabel = computed(() => {
    const tracking = this.tracking();
    return (
      tracking?.lastLocationLabel ||
      tracking?.presence.lastLocationLabel ||
      'Position du prestataire'
    );
  });
  protected readonly routeMapStatusLabel = computed(() => {
    if (this.hasTravelerArrivalConfirmation()) return 'Arrive a destination';
    if (!this.hasTrackingCoordinates()) return 'Position GPS prestataire en attente';
    if (this.destinationStatus() === 'resolving') return "Localisation de l'adresse...";
    if (this.destinationStatus() === 'unavailable') return "Adresse introuvable sur la carte";
    if (this.routeStatus() === 'unavailable') return 'Carte indisponible pour le moment';
    if (this.routeStatus() === 'calculating') return "Calcul de l'itineraire...";
    if (this.routeStatus() === 'ready') {
      const minutes = this.estimatedArrivalMinutes();
      return minutes > 0 ? `Itineraire reel - ${minutes} min` : 'Itineraire reel pret';
    }
    return 'Carte en temps reel';
  });
  protected readonly shouldShowMapEmptyState = computed(
    () =>
      !this.hasTravelerArrivalConfirmation() &&
      (!this.hasActiveTrackingNavigation() ||
        !this.hasTrackingCoordinates() ||
        this.routeStatus() === 'unavailable'),
  );
  protected readonly navigationInstruction = computed(() => {
    if (this.isProviderWorking()) {
      return {
        instruction: `Vous etes arrive a destination de ${this.arrivalDestinationLabelFromCurrentAppointment()}.`,
        maneuver: 'ARRIVE',
        distanceMeters: 0,
      };
    }

    const route = this.routeOptions.find(
      (option) => option.id === this.selectedRouteId(),
    );
    const step = this.findUpcomingNavigationStep(route?.navigationSteps ?? []);
    return step
      ? {
          instruction: this.normalizeNavigationInstruction(step),
          maneuver: step.maneuver,
          distanceMeters: step.end
            ? this.distanceMetersBetweenCurrentPosition(step.end)
            : step.distanceMeters,
        }
      : {
          instruction:
            this.routeStatus() === 'calculating'
              ? "Calcul des indications de conduite..."
              : "Continuez sur l'itineraire affiche.",
          maneuver: null,
          distanceMeters: null,
        };
  });
  protected readonly navigationDistanceLabel = computed(() => {
    const distance = this.navigationInstruction().distanceMeters;
    if (typeof distance !== 'number' || distance <= 0) return '';
    return distance < 1000
      ? `${Math.max(10, Math.round(distance / 10) * 10)} m`
      : this.formatDistance(distance / 1000);
  });
  protected readonly arrivedAtLabel = computed(() => {
    const tracking = this.tracking();
    return this.formatTimeFromValue(
      tracking?.lastPositionAt ||
        tracking?.presence.lastPositionAt ||
        tracking?.updatedAt ||
        tracking?.startedAt,
    );
  });
  protected readonly estimatedEndLabel = computed(() => {
    const appointment = this.appointment();
    if (!appointment) return '--h--';

    const startedAt =
      this.tracking()?.lastPositionAt ||
      this.tracking()?.presence.lastPositionAt ||
      this.tracking()?.updatedAt ||
      this.tracking()?.startedAt ||
      appointment.scheduledAt;
    const startDate = new Date(startedAt);
    if (Number.isNaN(startDate.getTime())) return '--h--';

    startDate.setMinutes(startDate.getMinutes() + (appointment.durationMinutes || 30));
    return this.formatTimeFromDate(startDate);
  });
  protected readonly showUpcomingDetail = computed(() => {
    const appointment = this.appointment();
    return (
      !!appointment &&
      !this.isAppointmentCompleted() &&
      !this.hasPendingPriceAdjustment() &&
      (appointment.status === 'CONFIRMEE' || appointment.status === 'PAYEE_SEQUESTRE') &&
      this.isAppointmentInFuture(appointment)
    );
  });
  protected readonly showImmersiveDetail = computed(
    () =>
      this.showUpcomingDetail() ||
      this.shouldShowOperationalMap() ||
      this.isAppointmentCompleted(),
  );
  protected readonly detailUiState = computed<AppointmentDetailUiState>(() => {
    if (this.isLoading()) return 'loading';
    if (this.errorMessage()) return 'error';
    if (this.isProviderViewer() && !this.isAppointmentClosed()) return 'route';
    if (!this.isProviderViewer() && !this.isAppointmentClosed()) return 'route';
    if (this.isAppointmentCompleted()) return 'completed';
    if (this.isAppointmentClosed()) return 'closed';
    if (this.isProviderWorking()) return 'route';
    if (this.isProviderOnTheWay()) return 'route';
    if (this.isOperationalServiceDay()) return 'route';
    if (this.showUpcomingDetail()) return 'upcoming';
    return 'upcoming';
  });
  protected readonly upcomingCountdownLabel = computed(() => {
    const appointment = this.appointment();
    if (!appointment) return 'A venir';

    const scheduledAt = new Date(appointment.scheduledAt);
    if (Number.isNaN(scheduledAt.getTime())) return 'A venir';

    const today = new Date();
    const startToday = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
    const startAppointment = new Date(
      scheduledAt.getFullYear(),
      scheduledAt.getMonth(),
      scheduledAt.getDate(),
    ).getTime();
    const days = Math.ceil((startAppointment - startToday) / 86400000);

    if (days <= 0) return "Aujourd'hui";
    if (days === 1) return 'Demain';
    return `Dans ${days} jours`;
  });
  protected readonly upcomingPreparationProgress = computed(() => {
    const appointment = this.appointment();
    if (!appointment) return 20;

    const scheduledAt = new Date(appointment.scheduledAt);
    if (Number.isNaN(scheduledAt.getTime())) return 20;

    const hoursRemaining = (scheduledAt.getTime() - Date.now()) / 3600000;
    if (hoursRemaining <= 6) return 90;
    if (hoursRemaining <= 24) return 70;
    if (hoursRemaining <= 72) return 45;
    return 20;
  });
  protected readonly reservationNumberLabel = computed(() => {
    const id = this.appointment()?.id ?? '';
    const compact = id.replace(/-/g, '').toUpperCase();
    return `#RDV-${compact.slice(0, 4) || '----'}-${compact.slice(-5) || '-----'}`;
  });
  protected readonly upcomingMissionItems = computed(() => {
    const appointment = this.appointment();
    if (!appointment) return [];

    const rawItems = [appointment.notes, appointment.serviceDescription]
      .filter((value): value is string => Boolean(value?.trim()))
      .join('\n')
      .split(/\n|;/)
      .map((item) => item.trim())
      .filter(Boolean);

    return rawItems.slice(0, 3).map((label, index) => ({
      code: `INFO${index + 1}`,
      label,
      caption: `Info ${index + 1}`,
    }));
  });

  ngOnInit(): void {
    this.elapsedClockInterval = window.setInterval(() => {
      this.nowMs.set(Date.now());
    }, 1000);
    const appointmentId = this.route.snapshot.paramMap.get('id');
    if (!appointmentId) {
      this.router.navigate(['/appointments']);
      return;
    }

    this.loadAppointment(appointmentId);
  }

  ngAfterViewInit(): void {
    void this.initializeGoogleMaps();
  }

  ngOnDestroy(): void {
    this.stopLiveNavigation(this.appointment()?.id);
    this.exitMapFullscreen();
    if (this.elapsedClockInterval) {
      clearInterval(this.elapsedClockInterval);
    }
    this.trackingStore.reset();
  }

  protected goBack(): void {
    this.backNavigation.back(this.safeReturnUrl(), '/appointments', { preferReturnUrl: true });
  }

  protected durationLabel(appointment: AppointmentView): string {
    return `${appointment.durationMinutes || 30} MIN`;
  }

  protected avatarInitials(appointment: AppointmentView): string {
    return this.initialsFromName(appointment.doctorName, 'JD');
  }

  protected clientInitials(appointment: AppointmentView): string {
    return this.initialsFromName(appointment.clientName, 'CL');
  }

  protected providerRatingLabel(appointment: AppointmentView): string {
    const rating = appointment.professionalRating;
    const reviews = appointment.professionalReviews;
    if (typeof rating !== 'number' || reviews <= 0) {
      return 'Nouveau';
    }

    return `${rating.toFixed(1)} · ${reviews} avis`;
  }

  private initialsFromName(name: string, fallback: string): string {
    return userInitials(name, fallback);
  }

  protected serviceDescriptionLabel(appointment: AppointmentView): string {
    return (
      appointment.notes?.trim() ||
      appointment.serviceDescription?.trim() ||
      'Aucune note particuliere n a ete ajoutee a ce rendez-vous.'
    );
  }

  protected setRating(rating: number): void {
    this.selectedRating.set(rating);
    const appointment = this.appointment();
    if (!appointment || this.isSubmittingReview() || appointment.clientReviewedAt) return;

    this.isSubmittingReview.set(true);
    this.appointmentsService.submitReview(appointment.id, rating).subscribe({
      next: (updated) => {
        this.appointment.update((current) =>
          this.mergeAppointment(current ?? appointment, updated),
        );
        this.isSubmittingReview.set(false);
        this.feedback.success('Merci, votre avis a ete enregistre.');
      },
      error: () => {
        this.selectedRating.set(appointment.clientRating ?? 0);
        this.isSubmittingReview.set(false);
        this.feedback.error("Impossible d'enregistrer votre avis pour le moment.");
      },
    });
  }

  protected updateMedicalDraft(kind: MedicalRecordKind, value: string): void {
    if (kind === 'act') {
      this.currentMedicalAct.set(value);
      return;
    }
    if (kind === 'vaccine') {
      this.currentMedicalVaccine.set(value);
      return;
    }
    this.currentMedicalTreatment.set(value);
  }

  protected addMedicalRecord(kind: MedicalRecordKind, value?: string): void {
    const draft =
      value ??
      (kind === 'act'
        ? this.currentMedicalAct()
        : kind === 'vaccine'
        ? this.currentMedicalVaccine()
        : this.currentMedicalTreatment());
    const normalized = draft.trim();
    if (normalized.length < 2) {
      this.feedback.info('Renseignez un libelle medical valide.');
      return;
    }

    const target =
      kind === 'act'
        ? this.medicalActs
        : kind === 'vaccine'
        ? this.medicalVaccines
        : this.medicalTreatments;

    if (target().some((item) => item.toLocaleLowerCase('fr-FR') === normalized.toLocaleLowerCase('fr-FR'))) {
      this.feedback.info('Cet element est deja ajoute au dossier.');
      return;
    }

    target.update((items) => [...items, normalized]);
    this.clearMedicalDraft(kind);
    this.feedback.success(
      kind === 'act'
        ? 'Acte medical ajoute.'
        : kind === 'vaccine'
        ? 'Vaccin ajoute.'
        : 'Traitement ajoute.',
    );
  }

  protected removeMedicalRecord(kind: MedicalRecordKind, index: number): void {
    const target =
      kind === 'act'
        ? this.medicalActs
        : kind === 'vaccine'
        ? this.medicalVaccines
        : this.medicalTreatments;
    target.update((items) => items.filter((_, itemIndex) => itemIndex !== index));
    this.feedback.info('Element retire du dossier medical.');
  }

  protected openPrescriptionPreview(): void {
    this.isPrescriptionPreviewOpen.set(true);
  }

  protected closePrescriptionPreview(): void {
    this.isPrescriptionPreviewOpen.set(false);
  }

  protected downloadMedicalReceipt(appointment: AppointmentView): void {
    this.downloadHtmlDocument(
      `recu-medical-jokko-${appointment.id.slice(0, 8)}.html`,
      'Recu medical Jokko',
      this.buildMedicalReceiptHtml(appointment),
    );
    this.feedback.success('Recu medical genere.');
  }

  protected downloadMedicalPrescription(appointment: AppointmentView): void {
    this.downloadHtmlDocument(
      `ordonnance-jokko-${appointment.id.slice(0, 8)}.html`,
      'Ordonnance medicale Jokko',
      this.buildMedicalPrescriptionHtml(appointment),
    );
    this.feedback.success('Ordonnance medicale generee.');
  }

  protected downloadInvoice(appointment: AppointmentView): void {
    const lines = [
      'Jokko - Recu de prestation',
      this.invoiceNumberLabel(),
      `Reservation: ${appointment.id}`,
      `Prestataire: ${appointment.doctorName}`,
      `Service: ${appointment.serviceName}`,
      `Adresse: ${appointment.addressLabel}`,
      `Date: ${appointment.fullDateLabel} a ${appointment.timeLabel}`,
      `Statut: ${appointment.status}`,
      `Montant: ${this.finalPriceLabel()}`,
      `Termine a: ${this.completedAtLabel()}`,
      `Duree reelle: ${this.realDurationLabel()}`,
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${this.invoiceNumberLabel().replace(/\s+/g, '-').toLowerCase()}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  }

  protected syncAppointmentToCalendar(appointment: AppointmentView): void {
    const start = new Date(appointment.scheduledAt);
    if (Number.isNaN(start.getTime())) {
      this.feedback.error('Impossible de synchroniser ce rendez-vous : date invalide.');
      return;
    }

    const end = new Date(start.getTime() + Math.max(15, appointment.durationMinutes || 30) * 60000);
    const stamp = this.toCalendarDate(new Date());
    const lines = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Jokko//Reservation//FR',
      'BEGIN:VEVENT',
      `UID:${appointment.id}@jokko`,
      `DTSTAMP:${stamp}`,
      `DTSTART:${this.toCalendarDate(start)}`,
      `DTEND:${this.toCalendarDate(end)}`,
      `SUMMARY:${this.escapeCalendarText(appointment.serviceName)} avec ${this.escapeCalendarText(appointment.doctorName)}`,
      `LOCATION:${this.escapeCalendarText(appointment.addressLabel)}`,
      `DESCRIPTION:${this.escapeCalendarText(appointment.notes || 'Rendez-vous reserve sur Jokko Dimbali.')}`,
      'END:VEVENT',
      'END:VCALENDAR',
    ];
    const blob = new Blob([lines.join('\r\n')], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `rendez-vous-jokko-${appointment.id.slice(0, 8)}.ics`;
    link.click();
    URL.revokeObjectURL(url);
    this.feedback.success('Fichier calendrier genere.');
  }

  protected mapDirectionsUrl(appointment: AppointmentView): string {
    const latitude = this.trackingLatitude();
    const longitude = this.trackingLongitude();
    const destination = encodeURIComponent(appointment.addressLabel);

    if (this.hasTrackingCoordinates() && latitude !== null && longitude !== null) {
      return `https://www.google.com/maps/dir/?api=1&origin=${latitude},${longitude}&destination=${destination}&travelmode=driving`;
    }

    return `https://www.google.com/maps/search/?api=1&query=${destination}`;
  }

  protected messageProvider(appointment: AppointmentView): void {
    this.messagesService
      .createConversation({
        reservationId: appointment.id,
        professionalProfileId: appointment.professionalId,
      })
      .subscribe({
        next: (conversation) => {
          this.router.navigate(['/messages'], {
            queryParams: {
              conversationId: conversation.id,
              professionalId: appointment.professionalId,
              providerName: appointment.doctorName,
              serviceName: appointment.serviceName,
              reservationId: appointment.id,
              appointmentDate: appointment.scheduledAt,
              address: appointment.addressLabel,
              status: appointment.status,
            },
          });
        },
        error: () => {
          this.feedback.error("Impossible d'ouvrir la discussion avec ce prestataire.");
        },
      });
  }

  protected bookAgain(appointment: AppointmentView): void {
    this.router.navigate(['/services'], {
      queryParams: {
        professionalId: appointment.professionalId,
        serviceId: appointment.serviceId,
        serviceName: appointment.serviceName,
      },
    });
  }

  protected payAppointment(appointment: AppointmentView): void {
    if (!this.canClientPayAppointment()) {
      this.feedback.info('Le paiement nest pas disponible pour ce statut de rendez-vous.');
      return;
    }

    const isMedicineAppointment = this.router.url.startsWith('/medecine/reservations/');
    const commands = isMedicineAppointment
      ? ['/medecine', 'reservations', appointment.id, 'paiement']
      : ['/appointments', appointment.id, 'payment'];

    this.router.navigate(commands, {
      queryParams: {
        returnUrl: this.router.url,
        ...(isMedicineAppointment ? { source: 'medecine' } : {}),
      },
    });
  }

  protected contactProviderByPhone(appointment: AppointmentView): void {
    this.callPhoneNumber(appointment.professionalPhone, 'Le numero du prestataire nest pas renseigne.');
  }

  protected contactClientByPhone(appointment: AppointmentView): void {
    this.callPhoneNumber(appointment.clientPhone, 'Le numero du client nest pas renseigne.');
  }

  private callPhoneNumber(phoneNumber: string | null, missingMessage: string): void {
    const phone = phoneNumber?.trim();
    if (!phone) {
      this.feedback.info(missingMessage);
      return;
    }

    if (typeof window !== 'undefined') {
      window.location.href = `tel:${phone.replace(/\s/g, '')}`;
    }
  }

  protected reportAppointment(): void {
    const appointment = this.appointment();
    if (!appointment || this.isUpdatingStatus()) return;

    const reason = this.isProviderViewer()
      ? "Signalement prestataire : incident constate sur le rendez-vous."
      : "Signalement client : le prestataire ne s'est pas presente ou la prestation n'a pas ete honoree.";

    this.isUpdatingStatus.set(true);
    this.appointmentsService.openDispute(appointment.id, reason).subscribe({
      next: (updated) => {
        this.appointment.update((current) =>
          this.mergeAppointment(current ?? appointment, updated),
        );
        this.synchronizeLiveNavigation(updated);
        this.isUpdatingStatus.set(false);
        this.feedback.success('Signalement envoye. Le rendez-vous est passe en litige.');
      },
      error: (error) => {
        this.isUpdatingStatus.set(false);
        this.feedback.error(
          getHttpErrorMessage(
            error,
            "Impossible d'ouvrir un litige pour le moment. La reservation doit etre terminee, non honoree, ou depassee.",
          ),
        );
      },
    });
  }

  protected openQrCodePage(
    appointment: AppointmentView,
    type: 'expediteur' | 'destinataire',
  ): void {
    if (!this.isParcelTransportAppointment(appointment)) return;

    this.router.navigate(['/appointments', appointment.id, 'qr', type], {
      queryParams: { returnUrl: this.router.url },
    });
  }

  protected openDisputeTracking(appointment: AppointmentView): void {
    this.router.navigate(['/litiges'], {
      queryParams: { reservationId: appointment.id },
    });
  }

  protected isParcelTransportAppointment(appointment: AppointmentView): boolean {
    return appointment.travelMode === 'TRANSPORT_COLIS';
  }

  protected arrivalDestinationLabel(appointment: AppointmentView): string {
    const service = (appointment.serviceName || '').trim().toLowerCase();
    if (service) return service;

    const address = (appointment.addressLabel || '').trim();
    return address ? address : 'la prestation';
  }

  protected acceptPriceAdjustment(appointment: AppointmentView): void {
    if (this.isHandlingPriceAdjustment()) return;

    this.isHandlingPriceAdjustment.set(true);
    this.appointmentsService.acceptPriceAdjustment(appointment.id).subscribe({
      next: (updated) => {
        this.appointment.update((current) =>
          this.mergeAppointment(current ?? appointment, updated),
        );
        this.isHandlingPriceAdjustment.set(false);
        this.feedback.success('Ajustement du prix accepte.');
      },
      error: () => {
        this.isHandlingPriceAdjustment.set(false);
        this.feedback.error("Impossible d'accepter cet ajustement pour le moment.");
      },
    });
  }

  protected rejectPriceAdjustment(appointment: AppointmentView): void {
    if (this.isHandlingPriceAdjustment()) return;

    this.isHandlingPriceAdjustment.set(true);
    this.appointmentsService.rejectPriceAdjustment(appointment.id).subscribe({
      next: (updated) => {
        this.appointment.update((current) =>
          this.mergeAppointment(current ?? appointment, updated),
        );
        this.isHandlingPriceAdjustment.set(false);
        this.feedback.success('Ajustement du prix refuse.');
      },
      error: () => {
        this.isHandlingPriceAdjustment.set(false);
        this.feedback.error('Impossible de refuser cet ajustement pour le moment.');
      },
    });
  }

  protected submitNegotiation(appointment: AppointmentView, proposedPrice: number): void {
    this.priceAdjustmentForm.proposedPrice = proposedPrice;
    this.priceAdjustmentForm.reason = 'Ajustement propose depuis la negociation de reservation.';
    this.submitPriceAdjustment(appointment);
  }

  protected openRescheduleModal(appointment: AppointmentView): void {
    this.rescheduleDateTime.set(this.toDateTimeLocalValue(new Date(appointment.scheduledAt)));
    this.isRescheduleModalOpen.set(true);
  }

  protected closeRescheduleModal(): void {
    if (this.isUpdatingStatus()) return;
    this.isRescheduleModalOpen.set(false);
  }

  protected saveReschedule(appointment: AppointmentView): void {
    if (this.isUpdatingStatus()) return;
    const date = new Date(this.rescheduleDateTime());
    if (Number.isNaN(date.getTime()) || date.getTime() <= Date.now()) {
      this.feedback.info('Choisissez une nouvelle date future pour le rendez-vous.');
      return;
    }

    this.isUpdatingStatus.set(true);
    this.appointmentsService
      .rescheduleAppointment(appointment.id, { newDateTime: date.toISOString() })
      .subscribe({
        next: (updated) => {
          this.appointment.update((current) =>
            this.mergeAppointment(current ?? appointment, updated),
          );
          this.synchronizeLiveNavigation(updated);
          this.isUpdatingStatus.set(false);
          this.isRescheduleModalOpen.set(false);
          this.feedback.success('Rendez-vous reprogramme.');
        },
        error: () => {
          this.isUpdatingStatus.set(false);
          this.feedback.error('Impossible de reprogrammer ce rendez-vous.');
        },
      });
  }

  protected cancelAppointment(appointment: AppointmentView): void {
    if (this.isUpdatingStatus() || !this.canCancelAppointment()) return;
    this.isUpdatingStatus.set(true);
    this.appointmentsService
      .cancelAppointment(appointment.id, 'Annulation demandee depuis le detail du rendez-vous.')
      .subscribe({
        next: (updated) => {
          this.appointment.update((current) =>
            this.mergeAppointment(current ?? appointment, updated),
          );
          this.synchronizeLiveNavigation(updated);
          this.isUpdatingStatus.set(false);
          this.feedback.success('Rendez-vous annule.');
        },
        error: () => {
          this.isUpdatingStatus.set(false);
          this.feedback.error("Impossible d'annuler ce rendez-vous.");
        },
      });
  }

  protected openPriceAdjustmentModal(appointment: AppointmentView): void {
    this.priceAdjustmentForm.proposedPrice = appointment.agreedPrice ?? 0;
    this.priceAdjustmentForm.reason = '';
    this.isPriceAdjustmentModalOpen.set(true);
  }

  protected closePriceAdjustmentModal(): void {
    if (this.isHandlingPriceAdjustment()) return;
    this.isPriceAdjustmentModalOpen.set(false);
  }

  protected submitPriceAdjustment(appointment: AppointmentView): void {
    if (this.isHandlingPriceAdjustment()) return;
    const proposedPrice = Math.trunc(Number(this.priceAdjustmentForm.proposedPrice));
    const reason = this.priceAdjustmentForm.reason.trim();
    if (!Number.isFinite(proposedPrice) || proposedPrice < 500) {
      this.feedback.info('Renseignez un montant valide a partir de 500 FCFA.');
      return;
    }
    if (reason.length < 8) {
      this.feedback.info('Expliquez clairement la raison de cet ajustement.');
      return;
    }

    this.isHandlingPriceAdjustment.set(true);
    this.appointmentsService
      .proposePriceAdjustment(appointment.id, { proposedPrice, reason })
      .subscribe({
        next: (updated) => {
          this.appointment.update((current) =>
            this.mergeAppointment(current ?? appointment, updated),
          );
          this.isHandlingPriceAdjustment.set(false);
          this.isPriceAdjustmentModalOpen.set(false);
          this.feedback.success('Ajustement de prix envoye au client.');
        },
        error: () => {
          this.isHandlingPriceAdjustment.set(false);
          this.feedback.error("Impossible d'envoyer cet ajustement de prix.");
        },
      });
  }

  protected markNoShow(appointment: AppointmentView): void {
    if (this.isUpdatingStatus()) return;
    if (!this.canProviderMarkClientAbsent()) {
      this.feedback.info(
        "L'absence client peut etre signalee apres l'heure du rendez-vous, sur une reservation payee ou en cours.",
      );
      return;
    }

    this.isUpdatingStatus.set(true);
    this.appointmentsService.markNoShow(appointment.id).subscribe({
      next: (updated) => {
        this.appointment.update((current) =>
          this.mergeAppointment(current ?? appointment, updated),
        );
        this.synchronizeLiveNavigation(updated);
        this.isUpdatingStatus.set(false);
        this.feedback.success('Absence client signalee sur ce rendez-vous.');
      },
      error: () => {
        this.isUpdatingStatus.set(false);
        this.feedback.error("Impossible de signaler l'absence pour ce rendez-vous.");
      },
    });
  }

  protected async markOnTheWay(appointment: AppointmentView): Promise<void> {
    await this.transitionOnTheWay(appointment, false);
  }

  protected markTravelerArrived(appointment: AppointmentView): void {
    if (!this.canTravelerMarkArrived()) {
      this.feedback.info(
        this.clientTravelsToProvider()
          ? "Le client doit d'abord partager sa position et arriver a destination."
          : "Le trajet doit etre actif avant de confirmer l'arrivee.",
      );
      return;
    }

    if (this.providerTravelsToClient()) {
      this.transitionStartWork(appointment, false);
      return;
    }

    this.confirmClientArrival(appointment);
  }

  protected shareProviderLocation(appointment: AppointmentView): void {
    if (this.isUpdatingStatus() || !this.isRouteActorViewer()) return;

    this.isUpdatingStatus.set(true);
    this.feedback.info(
      "Autorisez la localisation du navigateur pour partager automatiquement votre position reelle.",
    );
    this.resolveCurrentLocation(this.trackedTravelerPositionLabel())
      .then((location) => {
        const handleSuccess = (tracking: AppointmentTrackingView): void => {
          this.setTrackingSafely(tracking);
          this.startProviderLocationSharing(appointment.id);
          this.isUpdatingStatus.set(false);
          this.feedback.success('Position partagee. Le trajet peut demarrer.');
        };

        this.appointmentsService.markProviderOnTheWay(appointment.id, location).subscribe({
          next: handleSuccess,
          error: () => {
            this.stopProviderLocationSharing();
            this.refreshTracking(appointment.id);
            this.isUpdatingStatus.set(false);
            this.feedback.error(
              "Impossible de partager la position. Verifiez le GPS et l'etat de la reservation.",
            );
          },
        });
      })
      .catch((error) => {
        this.isUpdatingStatus.set(false);
        this.feedback.error(this.providerLocationHelpMessage(error));
      });
  }

  protected toggleSatelliteMap(): void {
    this.isSatelliteMapEnabled.update((enabled) => !enabled);
    this.mapRenderer.setSatellite(this.isSatelliteMapEnabled());
  }

  protected toggleMapFullscreen(): void {
    if (this.isMapFullscreen()) {
      this.exitMapFullscreen();
      return;
    }

    this.isMapFullscreen.set(true);
    window.setTimeout(() => this.updateGoogleMaps(), 80);
  }

  protected exitMapFullscreen(): void {
    if (!this.isMapFullscreen()) return;
    this.isMapFullscreen.set(false);
    window.setTimeout(() => this.updateGoogleMaps(), 80);
  }

  protected setMapDirection(headingDegrees: number): void {
    const normalizedHeading = ((headingDegrees % 360) + 360) % 360;
    this.mapHeadingDegrees.set(normalizedHeading);
    this.mapRenderer.setHeading(normalizedHeading);
  }

  protected toggleNavigationVoice(): void {
    this.isNavigationVoiceEnabled.update((enabled) => !enabled);
    if (this.isNavigationVoiceEnabled()) {
      this.lastSpokenNavigationKey = '';
      this.announceNavigationInstruction(true);
    } else if (typeof window !== 'undefined') {
      window.speechSynthesis?.cancel();
    }
  }

  protected selectRouteAlternative(routeId: string): void {
    const route = this.routeOptions.find((option) => option.id === routeId);
    if (!route) return;

    this.selectedRouteId.set(routeId);
    this.applySelectedRoute(route);
    this.refreshRouteAlternatives();
    this.updateGoogleMaps();
  }

  private async transitionOnTheWay(appointment: AppointmentView, silent: boolean): Promise<void> {
    if (this.isUpdatingStatus()) return;
    if (!this.canMarkTravelerOnTheWay()) {
      if (!silent) {
        this.feedback.info(
          "Le suivi en route s'active uniquement le jour de la prestation, apres paiement.",
        );
      }
      return;
    }

    this.isUpdatingStatus.set(true);
    if (!silent) {
      this.feedback.info(
        "Partagez votre position GPS reelle pour activer le trajet automatiquement.",
      );
    }

    const location = await this.resolveCurrentLocation(this.trackedTravelerPositionLabel()).catch(
      (error) => {
        if (!silent) {
          this.feedback.error(this.providerLocationHelpMessage(error));
        }
        return null;
      },
    );
    if (!location) {
      this.isUpdatingStatus.set(false);
      return;
    }
    this.appointmentsService.markProviderOnTheWay(appointment.id, location).subscribe({
      next: (tracking) => {
        this.setTrackingSafely(tracking);
        this.startProviderLocationSharing(appointment.id);
        this.isUpdatingStatus.set(false);
        if (!silent) {
          this.feedback.success(`Statut mis a jour : ${this.trackedTravelerRoleLabel()} en route.`);
        }
      },
      error: () => {
        this.isUpdatingStatus.set(false);
        if (!silent) {
          this.feedback.error(
            "Impossible d'activer le suivi en route. Verifiez que la reservation est payee.",
          );
        }
      },
    });
  }

  protected startWork(appointment: AppointmentView): void {
    this.transitionStartWork(appointment, false);
  }

  private transitionStartWork(appointment: AppointmentView, silent: boolean): void {
    if (this.isUpdatingStatus()) return;
    if (!this.canProviderStartWork()) {
      if (!silent) {
        this.feedback.info(
          "La prestation peut commencer uniquement quand le participant qui se deplace est arrive a destination.",
        );
      }
      return;
    }

    this.isUpdatingStatus.set(true);
    void this.animateTrackedTravelerArrival(appointment).then(() => {
      this.submitStartWork(appointment, silent);
    });
  }

  private submitStartWork(appointment: AppointmentView, silent: boolean): void {
    this.appointmentsService.startAppointment(appointment.id).subscribe({
      next: (updated) => {
        this.appointment.update((current) =>
          this.mergeAppointment(current ?? appointment, updated),
        );
        this.synchronizeLiveNavigation(updated);
        this.stopProviderLocationSharing();
        this.isUpdatingStatus.set(false);
        if (!silent) {
          this.feedback.success('Prestation demarree.');
        }
      },
      error: () => {
        this.isUpdatingStatus.set(false);
        if (!silent) {
          this.feedback.error(
            "Impossible de demarrer. Verifiez que le trajet est actif et que l'arrivee est confirmee.",
          );
        }
      },
    });
  }

  protected completeWork(appointment: AppointmentView): void {
    this.transitionCompleteWork(appointment, false);
  }

  private transitionCompleteWork(appointment: AppointmentView, silent: boolean): void {
    if (this.isUpdatingStatus()) return;
    if (!this.canProviderCompleteWork()) {
      if (!silent) {
        this.feedback.info(
          'La prestation doit etre demarree avant de pouvoir etre terminee.',
        );
      }
      return;
    }

    this.isUpdatingStatus.set(true);
    this.appointmentsService.completeAppointment(appointment.id).subscribe({
      next: (updated) => {
        this.appointment.update((current) =>
          this.mergeAppointment(current ?? appointment, updated),
        );
        this.synchronizeLiveNavigation(updated);
        this.loadTerminalTrackingSnapshot(appointment.id);
        this.isUpdatingStatus.set(false);
        if (!silent) {
          this.feedback.success('Prestation terminee.');
        }
      },
      error: () => {
        this.isUpdatingStatus.set(false);
        if (!silent) {
          this.feedback.error('Impossible de terminer cette prestation pour le moment.');
        }
      },
    });
  }

  protected workProgressSteps(): Array<{ label: string; state: 'done' | 'active' | 'pending' }> {
    return [
      { label: 'Diagnostic', state: 'done' },
      { label: 'Reparations', state: 'active' },
      { label: 'Test', state: 'pending' },
    ];
  }

  private loadAppointment(appointmentId: string): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);

    this.appointmentsService.getAppointmentById(appointmentId).subscribe({
      next: (appointment) => {
        this.appointment.set(appointment);
        this.selectedRating.set(appointment.clientRating ?? 0);
        this.isLoading.set(false);
        this.synchronizeLiveNavigation(appointment);
        if (appointment.status === 'TERMINEE') {
          this.loadTerminalTrackingSnapshot(appointment.id);
        } else if (!this.isTerminalStatus(appointment.status)) {
          this.resolveDestinationCoordinates(appointment.addressLabel);
          window.setTimeout(() => void this.initializeGoogleMaps(), 0);
        }
      },
      error: (error) => {
        const notFoundOrForbidden =
          error instanceof HttpErrorResponse && (error.status === 403 || error.status === 404);
        this.errorMessage.set(
          notFoundOrForbidden
            ? "Ce rendez-vous n'existe plus ou n'est pas accessible avec votre compte."
            : 'Impossible de charger ce rendez-vous.',
        );
        this.isLoading.set(false);
      },
    });
  }

  private safeReturnUrl(): string | null {
    const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl')?.trim();
    if (!returnUrl || !returnUrl.startsWith('/') || returnUrl.startsWith('//')) {
      return null;
    }

    return returnUrl;
  }

  private startTrackingPolling(appointmentId: string): void {
    this.trackingSubscription?.unsubscribe();
    this.missionSubscription?.unsubscribe();
    this.connectionSubscription?.unsubscribe();
    this.appointmentStatePollingSubscription?.unsubscribe();
    const fallbackPolling$ = timer(0, TRACKING_FALLBACK_POLL_INTERVAL_MS).pipe(
      switchMap(() =>
        this.appointmentsService
          .getAppointmentTracking(appointmentId)
          .pipe(catchError(() => of(null))),
      ),
    );
    const realtime$ = this.trackingRealtime
      .watchReservation(appointmentId)
      .pipe(catchError(() => of(null)));

    this.trackingSubscription = merge(fallbackPolling$, realtime$)
      .subscribe((tracking) => {
        if (tracking) {
          this.setTrackingSafely(tracking);
        }
      });
    this.connectionSubscription = this.trackingRealtime.connectionState$.subscribe(
      (state) => this.trackingStore.setConnectionState(state),
    );
    this.appointmentStatePollingSubscription = timer(
      APPOINTMENT_STATE_FALLBACK_INITIAL_DELAY_MS,
      APPOINTMENT_STATE_FALLBACK_INTERVAL_MS,
    )
      .pipe(
        switchMap(() =>
          this.isUpdatingStatus()
            ? of(null)
            : this.appointmentsService
                .getAppointmentById(appointmentId)
                .pipe(catchError(() => of(null))),
        ),
      )
      .subscribe((appointment) => {
        if (appointment) {
          this.applyRefreshedAppointment(appointment);
        }
      });
    this.missionSubscription = this.trackingRealtime.missionUpdated$.subscribe(
      (event) => {
        if (event.reservationId !== appointmentId) return;
        this.trackingStore.setMissionEvent(event);
        this.refreshAppointmentState(appointmentId);
        this.refreshTracking(appointmentId);
      },
    );
  }

  private synchronizeLiveNavigation(appointment: AppointmentView): void {
    if (this.isTerminalStatus(appointment.status)) {
      this.stopLiveNavigation(appointment.id, false);
      return;
    }

    if (!this.shouldRunLiveNavigation(appointment)) {
      this.stopLiveNavigation(appointment.id, false);
      return;
    }

    if (!this.trackingSubscription) {
      this.startTrackingPolling(appointment.id);
    }
  }

  private stopLiveNavigation(
    appointmentId?: string,
    resetTracking = false,
  ): void {
    this.trackingSubscription?.unsubscribe();
    this.missionSubscription?.unsubscribe();
    this.connectionSubscription?.unsubscribe();
    this.appointmentStatePollingSubscription?.unsubscribe();
    this.trackingSubscription = undefined;
    this.missionSubscription = undefined;
    this.connectionSubscription = undefined;
    this.appointmentStatePollingSubscription = undefined;
    this.stopProviderLocationSharing();
    if (appointmentId) {
      this.trackingRealtime.stopWatching(appointmentId);
    }
    this.resetNavigationPresentation();
    if (resetTracking) {
      this.trackingStore.reset();
    }
  }

  private suspendNavigationPresentation(): void {
    this.stopProviderLocationSharing();
    this.resetNavigationPresentation();
  }

  private resetNavigationPresentation(): void {
    if (typeof window !== 'undefined') {
      window.speechSynthesis?.cancel();
    }
    this.lastSpokenNavigationKey = '';
    this.mapRenderer.destroyRouteMap();
    this.routeCoordinates = [];
    this.routeOptions = [];
    this.routeAlternatives.set([]);
    this.routeCoordinatesKey = '';
    this.routeDistanceKm.set(null);
    this.routeDurationMinutes.set(null);
    this.routeStatus.set('idle');
  }

  private loadTerminalTrackingSnapshot(appointmentId: string): void {
    this.appointmentsService
      .getAppointmentTracking(appointmentId)
      .pipe(catchError(() => of(null)))
      .subscribe((tracking) => {
        if (tracking) {
          this.trackingStore.setTracking(tracking);
        }
      });
  }

  private isTerminalStatus(status: AppointmentView['status']): boolean {
    return this.isTerminalAppointmentStatus(status);
  }

  private shouldRunLiveNavigation(appointment: AppointmentView): boolean {
    return (
      LIVE_TRACKING_STATUSES.has(appointment.status) &&
      this.canShowLiveTracking(appointment)
    );
  }

  private refreshAppointmentState(appointmentId: string): void {
    this.appointmentsService
      .getAppointmentById(appointmentId)
      .pipe(catchError(() => of(null)))
      .subscribe((appointment) => {
        if (appointment) {
          this.applyRefreshedAppointment(appointment);
        }
      });
  }

  private confirmClientArrival(appointment: AppointmentView): void {
    const destination =
      this.destinationCoordinates() ??
      (this.trackingLatitude() !== null && this.trackingLongitude() !== null
        ? { lat: this.trackingLatitude() as number, lng: this.trackingLongitude() as number }
        : null);
    if (!destination) {
      this.feedback.info("Position d'arrivee en cours de localisation. Reessayez dans un instant.");
      this.resolveDestinationCoordinates(appointment.addressLabel);
      return;
    }

    this.isUpdatingStatus.set(true);
    this.routeDistanceKm.set(0);
    this.routeDurationMinutes.set(0);
    this.mapRenderer.render({
      provider: destination,
      destination,
      remainingLabel: 'Arrive',
      statusLabel: `Arrive a destination de ${this.arrivalDestinationLabel(appointment)}`,
      headingDegrees: this.reliableTrackingHeading(),
      routes: this.serializedMapRoutes(),
    });

    this.appointmentsService
      .updateProviderTrackingLocation(appointment.id, {
        latitude: destination.lat,
        longitude: destination.lng,
        accuracyMeters: 20,
        headingDegrees: this.reliableTrackingHeading(),
        speedKmh: 0,
        locationLabel: 'Client arrive a destination',
      })
      .subscribe({
        next: (tracking) => {
          this.setTrackingSafely(tracking);
          this.stopProviderLocationSharing();
          this.refreshAppointmentAfterArrival(appointment.id);
          this.feedback.success('Arrivee confirmee. Le medecin peut commencer la prestation.');
        },
        error: () => {
          this.isUpdatingStatus.set(false);
          this.feedback.error("Impossible de confirmer l'arrivee pour le moment.");
        },
      });
  }

  private refreshAppointmentAfterArrival(appointmentId: string): void {
    this.appointmentsService.getAppointmentById(appointmentId).subscribe({
      next: (updated) => {
        this.appointment.update((current) =>
          current ? this.mergeAppointment(current, updated) : updated,
        );
        this.synchronizeLiveNavigation(updated);
        this.isUpdatingStatus.set(false);
      },
      error: () => {
        this.refreshTracking(appointmentId);
        this.isUpdatingStatus.set(false);
      },
    });
  }

  private applyRefreshedAppointment(appointment: AppointmentView): void {
    const previousStatus = this.appointment()?.status;
    this.appointment.set(appointment);
    this.synchronizeLiveNavigation(appointment);
    if (appointment.status === 'TERMINEE' && previousStatus !== 'TERMINEE') {
      this.loadTerminalTrackingSnapshot(appointment.id);
    }
  }

  private animateTrackedTravelerArrival(appointment: AppointmentView): Promise<void> {
    const destination = this.destinationCoordinates();
    const latitude = this.trackingLatitude();
    const longitude = this.trackingLongitude();

    if (
      !destination ||
      latitude === null ||
      longitude === null ||
      !this.hasTrackingCoordinates() ||
      !this.hasActiveNavigationState()
    ) {
      return Promise.resolve();
    }

    this.routeDistanceKm.set(0);
    this.routeDurationMinutes.set(0);
    this.mapRenderer.render({
      provider: destination,
      destination,
      remainingLabel: 'Arrive',
      statusLabel: `Arrive a destination de ${this.arrivalDestinationLabel(appointment)}`,
      headingDegrees: this.reliableTrackingHeading(),
      routes: this.serializedMapRoutes(),
    });

    return new Promise((resolve) => {
      window.setTimeout(resolve, 850);
    });
  }

  private refreshTracking(appointmentId: string): void {
    this.appointmentsService
      .getAppointmentTracking(appointmentId)
      .pipe(catchError(() => of(null)))
      .subscribe((tracking) => {
        if (tracking) {
          this.setTrackingSafely(tracking);
        }
      });
  }

  private normalizeArrivedTravelerTracking(
    tracking: AppointmentTrackingView,
  ): AppointmentTrackingView {
    if (!this.trackingIndicatesArrival(tracking)) {
      return tracking;
    }

    return {
      ...tracking,
      route: {
        distanceRemainingMeters: 0,
        durationRemainingSeconds: 0,
        estimatedArrivalAt: new Date().toISOString(),
        encodedPolyline: '',
        coordinates:
          typeof tracking.lastLatitude === 'number' &&
          typeof tracking.lastLongitude === 'number'
            ? [
                {
                  latitude: tracking.lastLatitude,
                  longitude: tracking.lastLongitude,
                },
              ]
            : [],
        navigationSteps: [],
      },
    };
  }

  private trackingIndicatesArrival(
    tracking: AppointmentTrackingView | null | undefined,
  ): boolean {
    if (!tracking || !this.clientTravelsToProvider()) {
      return false;
    }

    const labels = [
      tracking.lastLocationLabel,
      tracking.presence.lastLocationLabel,
    ]
      .filter((value): value is string => Boolean(value?.trim()))
      .map((value) =>
        value
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .toLocaleLowerCase('fr-FR'),
      );

    return labels.some(
      (label) => label.includes('arrive') && label.includes('destination'),
    );
  }

  private setTrackingSafely(tracking: NonNullable<ReturnType<typeof this.tracking>>): void {
    window.setTimeout(() => {
      const normalizedTracking = this.normalizeArrivedTravelerTracking(tracking);
      this.trackingStore.setTracking(normalizedTracking);
      const appointment = this.appointment();
      if (appointment && !this.shouldRunLiveNavigation(appointment)) {
        this.stopLiveNavigation(appointment.id, false);
        return;
      }
      if (!this.hasActiveNavigationState()) {
        this.suspendNavigationPresentation();
        return;
      }
      if (this.trackingIndicatesArrival(normalizedTracking)) {
        this.routeDistanceKm.set(0);
        this.routeDurationMinutes.set(0);
        this.routeCoordinates = [];
        this.routeOptions = [];
        this.routeAlternatives.set([]);
        this.routeCoordinatesKey = '';
        this.routeStatus.set('ready');
        this.updateGoogleMaps();
        return;
      }

      const serverRoute = normalizedTracking.route;
      if (serverRoute) {
        this.routeDistanceKm.set(serverRoute.distanceRemainingMeters / 1000);
        this.routeDurationMinutes.set(
          Math.max(1, Math.round(serverRoute.durationRemainingSeconds / 60)),
        );
        this.routeCoordinates = serverRoute.coordinates.map(
          (coordinate) =>
            [coordinate.latitude, coordinate.longitude] as [number, number],
        );
        if (serverRoute.navigationSteps?.length) {
          const currentRoute: RouteOption = {
            id: 'route-0',
            coordinates: this.routeCoordinates,
            distanceKm: serverRoute.distanceRemainingMeters / 1000,
            durationMinutes: Math.max(
              1,
              Math.round(serverRoute.durationRemainingSeconds / 60),
            ),
            navigationSteps: serverRoute.navigationSteps.map((step) => ({
              id: step.id,
              instruction: step.instruction,
              maneuver: step.maneuver,
              distanceMeters: step.distanceMeters,
              end: step.end
                ? { lat: step.end.latitude, lng: step.end.longitude }
                : null,
            })),
          };
          this.routeOptions = [currentRoute];
          this.selectedRouteId.set(currentRoute.id);
        }
        this.routeStatus.set(
          this.routeCoordinates.length > 1 ? 'ready' : 'unavailable',
        );
      }
      this.updateGoogleMaps();
      this.announceNavigationInstruction();
      if (appointment && this.isRouteActorViewer() && this.isProviderOnTheWay()) {
        this.startProviderLocationSharing(appointment.id);
      }
    }, 0);
  }

  private startProviderLocationSharing(appointmentId: string): void {
    if (
      this.providerLocationSubscription ||
      !this.isRouteActorViewer()
    ) {
      return;
    }

    this.providerLocationSubscription = this.providerLocation
      .watch(8000)
      .subscribe({
      next: (position) => {
        if (!this.isProviderOnTheWay()) {
          this.stopProviderLocationSharing();
          return;
        }

        if (!this.isCoordinateInSenegal(position.latitude, position.longitude)) {
          return;
        }

        this.appointmentsService
          .updateProviderTrackingLocation(appointmentId, {
            latitude: position.latitude,
            longitude: position.longitude,
            accuracyMeters: position.accuracyMeters,
            headingDegrees: position.headingDegrees,
            speedKmh: position.speedKmh,
            locationLabel: this.trackedTravelerPositionLabel(),
          })
          .pipe(
            catchError((error) => {
              if (error instanceof HttpErrorResponse && error.status === 409) {
                this.stopProviderLocationSharing();
                this.refreshTracking(appointmentId);
              }
              return of(null);
            }),
          )
          .subscribe((tracking) => {
            if (tracking) {
              this.setTrackingSafely(tracking);
            }
          });
      },
      error: () => {
        this.stopProviderLocationSharing();
      },
    });
  }

  private stopProviderLocationSharing(): void {
    this.providerLocationSubscription?.unsubscribe();
    this.providerLocationSubscription = undefined;
  }

  private isServiceDay(appointment: AppointmentView): boolean {
    const scheduledAt = new Date(appointment.scheduledAt);
    if (Number.isNaN(scheduledAt.getTime())) return false;

    const today = new Date();
    return (
      scheduledAt.getFullYear() === today.getFullYear() &&
      scheduledAt.getMonth() === today.getMonth() &&
      scheduledAt.getDate() === today.getDate()
    );
  }

  private isProfessionalRole(role: string | null | undefined): boolean {
    return role === 'PRESTATAIRE' || role === 'MEDECIN';
  }

  private isClosedAppointmentStatus(status: AppointmentStatus): boolean {
    return CLOSED_APPOINTMENT_STATUSES.has(status);
  }

  private isTerminalAppointmentStatus(status: AppointmentStatus): boolean {
    return TERMINAL_APPOINTMENT_STATUSES.has(status);
  }

  private clearMedicalDraft(kind: MedicalRecordKind): void {
    if (kind === 'act') {
      this.currentMedicalAct.set('');
      return;
    }
    if (kind === 'vaccine') {
      this.currentMedicalVaccine.set('');
      return;
    }
    this.currentMedicalTreatment.set('');
  }

  private downloadHtmlDocument(fileName: string, title: string, body: string): void {
    const html = `<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${this.escapeHtml(title)}</title>
  <style>
    body{font-family:Arial,Helvetica,sans-serif;color:#111827;margin:0;background:#f8fafc}
    .sheet{background:#fff;margin:24px auto;max-width:820px;padding:42px;border:1px solid #e5e7eb}
    .top{display:flex;justify-content:space-between;gap:24px;border-bottom:2px solid #111827;padding-bottom:22px;margin-bottom:28px}
    h1{font-size:24px;margin:0 0 8px;text-transform:uppercase}
    h2{font-size:13px;letter-spacing:.12em;text-transform:uppercase;color:#865221;border-bottom:1px solid #eadccd;padding-bottom:8px;margin:28px 0 14px}
    p{margin:4px 0;line-height:1.5}.muted{color:#667085}.box{background:#f9fafb;border:1px solid #eef0f3;border-radius:12px;padding:16px}
    table{border-collapse:collapse;width:100%;font-size:13px}th{text-align:left;color:#667085;border-bottom:1px solid #e5e7eb;padding:10px 8px}td{border-bottom:1px solid #f0f2f4;padding:10px 8px}.right{text-align:right}.total{font-size:18px;font-weight:800;color:#865221}
    ol,ul{padding-left:22px}li{margin:8px 0;line-height:1.45}.signature{display:flex;justify-content:space-between;gap:24px;margin-top:54px}.stamp{border:1px solid #eadccd;border-radius:12px;background:#fff8f1;color:#865221;padding:18px 24px;text-align:center;font-weight:800}
    @media print{body{background:#fff}.sheet{border:0;margin:0;max-width:none}}
  </style>
</head>
<body><main class="sheet">${body}</main></body>
</html>`;
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    link.click();
    URL.revokeObjectURL(url);
  }

  private buildMedicalReceiptHtml(appointment: AppointmentView): string {
    const actsRows = this.medicalActs()
      .map(
        (act, index) => `<tr><td>${this.escapeHtml(act)}</td><td class="right">1</td><td class="right">${this.escapeHtml(
          this.formatCurrency(index === 0 ? this.finalPriceAmount() : 5000),
        )}</td></tr>`,
      )
      .join('');
    const vaccinesRows = this.medicalVaccines()
      .map(
        (vaccine) => `<tr><td>${this.escapeHtml(vaccine)}</td><td class="right">1</td><td class="right">${this.escapeHtml(
          this.formatCurrency(3000),
        )}</td></tr>`,
      )
      .join('');

    return `
      <div class="top">
        <div>
          <h1>Recu medical</h1>
          <p class="muted">Reference ${this.escapeHtml(this.invoiceCodeLabel())}</p>
          <p>Jokko Dimbali</p>
        </div>
        <div class="right">
          <p><strong>Date</strong></p>
          <p>${this.escapeHtml(this.formatLongDateTime(new Date().toISOString()))}</p>
        </div>
      </div>
      <section class="box">
        <p><strong>Patient:</strong> ${this.escapeHtml(appointment.clientName)}</p>
        <p><strong>Medecin:</strong> ${this.escapeHtml(appointment.doctorName)}</p>
        <p><strong>Motif:</strong> ${this.escapeHtml(appointment.serviceName)}</p>
        <p><strong>Adresse:</strong> ${this.escapeHtml(appointment.addressLabel)}</p>
      </section>
      <h2>Detail des honoraires</h2>
      <table>
        <thead><tr><th>Libelle</th><th class="right">Qte</th><th class="right">Montant</th></tr></thead>
        <tbody>${actsRows}${vaccinesRows}</tbody>
      </table>
      <p class="right total">Total paye: ${this.escapeHtml(this.medicalTotalLabel())}</p>
      <p class="muted">Document genere automatiquement depuis le dossier de consultation Jokko.</p>
    `;
  }

  private buildMedicalPrescriptionHtml(appointment: AppointmentView): string {
    return `
      <div class="top">
        <div>
          <h1>Ordonnance medicale</h1>
          <p><strong>${this.escapeHtml(appointment.doctorName)}</strong></p>
          <p class="muted">${this.escapeHtml(appointment.specialty || 'Medecin')}</p>
          <p class="muted">Reference rendez-vous: ${this.escapeHtml(appointment.id)}</p>
        </div>
        <div class="right">
          <p><strong>Date d'emission</strong></p>
          <p>${this.escapeHtml(this.formatLongDateTime(new Date().toISOString()))}</p>
        </div>
      </div>
      <section class="box">
        <p><strong>Prescrit a:</strong> ${this.escapeHtml(appointment.clientName)}</p>
        <p><strong>Motif de consultation:</strong> ${this.escapeHtml(appointment.serviceName)}</p>
        <p><strong>Adresse:</strong> ${this.escapeHtml(appointment.addressLabel)}</p>
      </section>
      <h2>Traitement medical prescrit</h2>
      ${
        this.medicalTreatments().length
          ? `<ol>${this.medicalTreatments()
              .map((treatment) => `<li>${this.escapeHtml(treatment)}</li>`)
              .join('')}</ol>`
          : '<p class="muted">Aucun traitement de fond prescrit sur cette ordonnance.</p>'
      }
      <h2>Vaccinations administrees</h2>
      ${
        this.medicalVaccines().length
          ? `<ul>${this.medicalVaccines()
              .map((vaccine) => `<li>${this.escapeHtml(vaccine)}</li>`)
              .join('')}</ul>`
          : '<p class="muted">Aucun vaccin administre pendant cette consultation.</p>'
      }
      <h2>Actes cliniques realises</h2>
      <ul>${this.medicalActs()
        .map((act) => `<li>${this.escapeHtml(act)}</li>`)
        .join('')}</ul>
      <div class="signature">
        <p class="muted">Ordonnance electronique securisee<br>ID: ORD-${this.escapeHtml(
          appointment.id.slice(0, 8).toUpperCase(),
        )}</p>
        <div class="stamp">Signature medecin<br>${this.escapeHtml(appointment.doctorName)}</div>
      </div>
    `;
  }

  private escapeHtml(value: string | number | null | undefined): string {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  private isAppointmentInFuture(appointment: AppointmentView): boolean {
    const scheduledAt = new Date(appointment.scheduledAt);
    if (Number.isNaN(scheduledAt.getTime())) return false;

    return scheduledAt.getTime() > Date.now();
  }

  private canShowLiveTracking(appointment: AppointmentView): boolean {
    return !this.isAppointmentInFuture(appointment) || this.isServiceDay(appointment);
  }

  private async initializeGoogleMaps(): Promise<void> {
    if (typeof window === 'undefined') return;

    try {
      if (this.trackingMapElement?.isConnected) {
        await this.mapRenderer.initializeRouteMap(
          this.trackingMapElement,
          this.isSatelliteMapEnabled(),
          (routeId) => this.selectRouteAlternative(routeId),
        );
        this.mapRenderer.setHeading(this.mapHeadingDegrees());
      }
      this.updateGoogleMaps();
    } catch {
      this.routeStatus.set('unavailable');
    }
  }

  private updateGoogleMaps(): void {
    if (!this.hasActiveNavigationState()) {
      return;
    }

    const latitude = this.trackingLatitude();
    const longitude = this.trackingLongitude();
    if (!this.hasTrackingCoordinates() || latitude === null || longitude === null) {
      return;
    }

    const destination = this.destinationCoordinates();
    const trackedProvider: [number, number] = [latitude, longitude];
    const displayedProvider: [number, number] =
      (this.isProviderWorking() || this.hasTravelerArrivalConfirmation()) && destination
        ? [destination.lat, destination.lng]
        : trackedProvider;
    if (destination && !this.isProviderWorking() && !this.hasTravelerArrivalConfirmation()) {
      this.loadRouteCoordinates(trackedProvider, [
        destination.lat,
        destination.lng,
      ]);
    }
    this.mapRenderer.render({
      provider: {
        lat: displayedProvider[0],
        lng: displayedProvider[1],
      },
      destination,
      remainingLabel: this.routeRemainingBadgeLabel(),
      statusLabel: this.vehicleStatusLabel(),
      headingDegrees: this.reliableTrackingHeading(),
      routes: this.serializedMapRoutes(),
    });
  }

  private serializedMapRoutes(): Array<{
    id: string;
    selected: boolean;
    coordinates: MapCoordinate[];
  }> {
    return this.routeOptions
      .filter((route) => route.coordinates.length > 1)
      .map((route) => ({
        id: route.id,
        selected: route.id === this.selectedRouteId(),
        coordinates: route.coordinates.map(([lat, lng]) => ({ lat, lng })),
      }));
  }

  protected runProviderPrimaryAction(appointment: AppointmentView): void {
    if (this.isAppointmentCompleted()) {
      this.downloadInvoice(appointment);
      return;
    }
    if (this.isProviderWorking()) {
      this.completeWork(appointment);
      return;
    }
    if (
      this.isProviderOnTheWay() ||
      (this.clientTravelsToProvider() && this.hasTravelerArrivalConfirmation())
    ) {
      this.startWork(appointment);
      return;
    }
    void this.markOnTheWay(appointment);
  }

  private vehicleStatusLabel(): string {
    const appointment = this.appointment();
    if (!appointment) return 'Trajet en cours';
    return this.isProviderWorking()
      ? `Arrive a destination de ${this.arrivalDestinationLabel(appointment)}`
      : `En route vers ${this.arrivalDestinationLabel(appointment)} · ${this.routeEtaLabel()}`;
  }

  private trackedTravelerPositionLabel(): string {
    return this.clientTravelsToProvider()
      ? 'Position GPS du client'
      : 'Position GPS du prestataire';
  }

  private reliableTrackingHeading(): number | null {
    if (this.isProviderWorking()) {
      return null;
    }

    const tracking = this.tracking();
    const speed =
      tracking?.lastSpeedKmh ?? tracking?.presence.lastSpeedKmh ?? null;
    const heading =
      tracking?.lastHeadingDegrees ??
      tracking?.presence.lastHeadingDegrees ??
      null;
    return typeof speed === 'number' &&
      speed >= 3 &&
      typeof heading === 'number' &&
      Number.isFinite(heading)
      ? heading
      : null;
  }

  private arrivalDestinationLabelFromCurrentAppointment(): string {
    const appointment = this.appointment();
    return appointment
      ? this.arrivalDestinationLabel(appointment)
      : 'la destination';
  }

  private findUpcomingNavigationStep(
    steps: RouteNavigationStep[],
  ): RouteNavigationStep | null {
    if (steps.length === 0) return null;
    const withDistance = steps
      .map((step) => ({
        step,
        distance: step.end
          ? this.distanceMetersBetweenCurrentPosition(step.end)
          : Number.POSITIVE_INFINITY,
      }))
      .filter(({ distance }) => Number.isFinite(distance) && distance > 12)
      .sort((left, right) => left.distance - right.distance);
    return withDistance[0]?.step ?? steps[0];
  }

  private normalizeNavigationInstruction(step: RouteNavigationStep): string {
    const instruction = step.instruction.replace(/<[^>]+>/g, '').trim();
    if (instruction) return instruction;

    const maneuver = step.maneuver?.toUpperCase() ?? '';
    if (maneuver.includes('LEFT')) return 'Tournez a gauche.';
    if (maneuver.includes('RIGHT')) return 'Tournez a droite.';
    if (maneuver.includes('UTURN')) return 'Faites demi-tour.';
    if (maneuver.includes('ROUNDABOUT')) return 'Entrez dans le rond-point.';
    return 'Continuez tout droit.';
  }

  private distanceMetersBetweenCurrentPosition(
    destination: MapCoordinate,
  ): number {
    const latitude = this.trackingLatitude();
    const longitude = this.trackingLongitude();
    if (latitude === null || longitude === null) {
      return Number.POSITIVE_INFINITY;
    }

    const earthRadius = 6_371_000;
    const latitudeDelta = ((destination.lat - latitude) * Math.PI) / 180;
    const longitudeDelta = ((destination.lng - longitude) * Math.PI) / 180;
    const originLatitude = (latitude * Math.PI) / 180;
    const destinationLatitude = (destination.lat * Math.PI) / 180;
    const a =
      Math.sin(latitudeDelta / 2) ** 2 +
      Math.cos(originLatitude) *
        Math.cos(destinationLatitude) *
        Math.sin(longitudeDelta / 2) ** 2;
    return earthRadius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  private announceNavigationInstruction(force = false): void {
    if (
      !this.hasActiveNavigationState() ||
      !this.isNavigationVoiceEnabled() ||
      typeof window === 'undefined' ||
      !('speechSynthesis' in window)
    ) {
      return;
    }

    const navigation = this.navigationInstruction();
    const key = `${navigation.maneuver ?? 'CONTINUE'}|${navigation.instruction}`;
    if (!force && key === this.lastSpokenNavigationKey) return;

    this.lastSpokenNavigationKey = key;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(
      navigation.distanceMeters && navigation.distanceMeters > 30
        ? `Dans ${this.navigationDistanceLabel()}, ${navigation.instruction}`
        : navigation.instruction,
    );
    utterance.lang = 'fr-FR';
    utterance.rate = 0.95;
    window.speechSynthesis.speak(utterance);
  }

  private hasActiveNavigationState(): boolean {
    return this.hasActiveTrackingNavigation();
  }

  private destroyRouteMap(): void {
    this.mapRenderer.destroyRouteMap();
    this.trackingMapElement = undefined;
  }

  private loadRouteCoordinates(provider: [number, number], destinationPoint: [number, number]): void {
    const key = `${this.routePointKey(provider)}|${this.routePointKey(destinationPoint)}`;
    if (this.routeCoordinatesKey === key) return;
    this.routeCoordinatesKey = key;
    this.routeCoordinates = [];
    this.routeOptions = [];
    this.routeAlternatives.set([]);
    this.routeDistanceKm.set(null);
    this.routeDurationMinutes.set(null);
    this.routeStatus.set('calculating');

    this.appointmentsService
      .computeRoutes({
        origin: {
          latitude: provider[0],
          longitude: provider[1],
        },
        destination: {
          latitude: destinationPoint[0],
          longitude: destinationPoint[1],
        },
      })
      .subscribe({
        next: (googleRoutes) => {
          const routes = googleRoutes
          .map((route, index): RouteOption | null => {
            const coordinates = route.coordinates
              .map((coordinate) => [coordinate.latitude, coordinate.longitude] as [number, number])
              .filter(([lat, lng]) => this.isCoordinateInSenegal(lat, lng));
            if (coordinates.length < 2) return null;

            return {
              id: `route-${index}`,
              coordinates,
              distanceKm:
                typeof route.distanceMeters === 'number'
                  ? Math.max(0.1, route.distanceMeters / 1000)
                  : null,
              durationMinutes:
                typeof route.durationSeconds === 'number'
                  ? Math.max(1, Math.round(route.durationSeconds / 60))
                  : null,
              navigationSteps: (route.navigationSteps ?? []).map((step) => ({
                id: step.id,
                instruction: step.instruction,
                maneuver: step.maneuver,
                distanceMeters: step.distanceMeters,
                end: step.end
                  ? { lat: step.end.latitude, lng: step.end.longitude }
                  : null,
              })),
            };
          })
          .filter((route): route is RouteOption => !!route)
          .sort((left, right) => (left.durationMinutes ?? 99999) - (right.durationMinutes ?? 99999));
        const route = routes[0];
        if (
          !route ||
          !this.isCoordinateInSenegal(provider[0], provider[1]) ||
          !this.isCoordinateInSenegal(destinationPoint[0], destinationPoint[1])
        ) {
          this.routeCoordinates = [];
          this.routeOptions = [];
          this.routeAlternatives.set([]);
          this.mapRenderer.resetRoute();
          this.routeStatus.set('unavailable');
          return;
        }

        this.routeOptions = routes.map((option, index) => ({
          ...option,
          id: `route-${index}`,
        }));
        this.selectedRouteId.set(this.routeOptions[0]?.id ?? 'route-0');
        this.applySelectedRoute(this.routeOptions[0]);
        if (this.routeCoordinates.length < 2) {
          this.mapRenderer.resetRoute();
          this.routeStatus.set('unavailable');
          return;
        }

        this.refreshRouteAlternatives();
        this.routeStatus.set(this.routeCoordinates.length > 1 ? 'ready' : 'unavailable');
        this.updateGoogleMaps();
        this.announceNavigationInstruction();
        },
        error: () => {
        this.routeCoordinates = [];
        this.routeOptions = [];
        this.routeAlternatives.set([]);
        this.mapRenderer.resetRoute();
        this.routeDistanceKm.set(null);
        this.routeDurationMinutes.set(null);
        this.routeStatus.set('unavailable');
        },
      });
  }

  private applySelectedRoute(route: RouteOption | undefined): void {
    if (!route) return;

    this.routeCoordinates = route.coordinates;
    this.routeDistanceKm.set(route.distanceKm);
    this.routeDurationMinutes.set(route.durationMinutes);
  }

  private refreshRouteAlternatives(): void {
    this.routeAlternatives.set(
      this.routeOptions.map((route, index) => ({
        id: route.id,
        label: index === 0 ? 'Plus rapide' : `Alternative ${index + 1}`,
        distanceLabel: route.distanceKm ? this.formatDistance(route.distanceKm) : '-- km',
        durationLabel: route.durationMinutes ? `${route.durationMinutes} min` : '-- min',
        isSelected: route.id === this.selectedRouteId(),
      })),
    );
  }

  private routePointKey(point: [number, number]): string {
    return point.map((value) => value.toFixed(5)).join(',');
  }

  private resolveDestinationCoordinates(addressLabel: string): void {
    this.destinationCoordinates.set(null);
    this.destinationStatus.set('idle');
    this.routeStatus.set('idle');
    this.routeCoordinates = [];
    this.routeOptions = [];
    this.routeAlternatives.set([]);
    this.routeCoordinatesKey = '';
    this.mapRenderer.resetRoute();
    this.routeDistanceKm.set(null);
    this.routeDurationMinutes.set(null);
    const query = this.normalizeAddressQuery(addressLabel);
    if (!query || typeof window === 'undefined') return;
    const explicitCoordinates = this.extractCoordinatesFromAddress(query);
    if (!explicitCoordinates && this.hasCoordinateLikeAddress(query)) {
      this.destinationStatus.set('unavailable');
      return;
    }

    if (explicitCoordinates) {
      this.destinationCoordinates.set(explicitCoordinates);
      this.destinationStatus.set('ready');
      this.updateGoogleMaps();
      return;
    }

    this.destinationStatus.set('resolving');

    this.appointmentsService.geocodeAddress(query).subscribe({
      next: (result) => {
        if (result && this.isCoordinateInSenegal(result.latitude, result.longitude)) {
          this.destinationCoordinates.set({
            lat: result.latitude,
            lng: result.longitude,
          });
          this.destinationStatus.set('ready');
          this.updateGoogleMaps();
          return;
        }
        this.destinationStatus.set('unavailable');
      },
      error: () => {
        this.destinationStatus.set('unavailable');
      },
    });
  }

  private normalizeAddressQuery(value: string): string {
    return value
      .replace(/\([^)]*\)/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private extractCoordinatesFromAddress(value: string): MapCoordinate | null {
    const match = value.match(/(-?\d{1,2}(?:[.,]\d+)?)\s*[,;]\s*(-?\d{1,3}(?:[.,]\d+)?)/);
    if (!match) return null;

    const lat = Number(match[1].replace(',', '.'));
    const lng = Number(match[2].replace(',', '.'));
    if (!this.isCoordinateInSenegal(lat, lng)) return null;

    return { lat, lng };
  }

  private hasCoordinateLikeAddress(value: string): boolean {
    return /-?\d{1,2}(?:[.,]\d+)?\s*[,;]\s*-?\d{1,3}(?:[.,]\d+)?/.test(value);
  }

  private isValidCoordinatePair(lat: number, lng: number): boolean {
    return Number.isFinite(lat) && Number.isFinite(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
  }

  private isCoordinateInSenegal(lat: number, lng: number): boolean {
    return (
      this.isValidCoordinatePair(lat, lng) &&
      lat >= SENEGAL_GEO_BOUNDS.minLat &&
      lat <= SENEGAL_GEO_BOUNDS.maxLat &&
      lng >= SENEGAL_GEO_BOUNDS.minLng &&
      lng <= SENEGAL_GEO_BOUNDS.maxLng
    );
  }

  private mergeAppointment(current: AppointmentView, updated: AppointmentView): AppointmentView {
    return {
      ...current,
      ...updated,
      doctorName: current.doctorName,
      specialty: current.specialty,
      avatarUrl: current.avatarUrl,
      professionalPhone: current.professionalPhone,
      professionalRating: current.professionalRating,
      professionalReviews: current.professionalReviews,
      clientName: current.clientName,
      clientPhone: current.clientPhone,
      clientAvatarUrl: current.clientAvatarUrl,
      serviceName: current.serviceName,
      serviceDescription: current.serviceDescription,
    };
  }

  private formatDistance(value: number): string {
    return `${new Intl.NumberFormat('fr-FR', {
      maximumFractionDigits: 1,
    }).format(value)} km`;
  }

  protected formatCurrency(value: number): string {
    return `${new Intl.NumberFormat('fr-FR', {
      maximumFractionDigits: 0,
    })
      .format(value || 0)
      .replace(/\s/g, ' ')} FCFA`;
  }

  private formatTimeFromValue(value: string | null | undefined): string {
    if (!value) return '--h--';
    return this.formatTimeFromDate(new Date(value));
  }

  private formatTimeFromDate(value: Date): string {
    if (Number.isNaN(value.getTime())) return '--h--';

    return new Intl.DateTimeFormat('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
    })
      .format(value)
      .replace(':', 'h');
  }

  private formatLongDateTime(value: string | null | undefined): string {
    if (!value) return 'date non renseignee';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'date non renseignee';

    return new Intl.DateTimeFormat('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
      .format(date)
      .replace(',', ' a')
      .replace(':', 'h');
  }

  private toDateTimeLocalValue(value: Date): string {
    if (Number.isNaN(value.getTime())) {
      return this.toDateTimeLocalValue(new Date(Date.now() + 60 * 60 * 1000));
    }

    const localDate = new Date(value.getTime() - value.getTimezoneOffset() * 60000);
    return localDate.toISOString().slice(0, 16);
  }

  private toCalendarDate(value: Date): string {
    return value
      .toISOString()
      .replace(/[-:]/g, '')
      .replace(/\.\d{3}Z$/, 'Z');
  }

  private escapeCalendarText(value: string): string {
    return value
      .replace(/\\/g, '\\\\')
      .replace(/;/g, '\\;')
      .replace(/,/g, '\\,')
      .replace(/\n/g, '\\n');
  }

  private providerLocationHelpMessage(error: unknown): string {
    const message = error instanceof Error ? error.message : '';

    if (message.includes('permission denied')) {
      return "Autorisez la localisation pour partager automatiquement votre position. Cliquez sur le cadenas de la barre d'adresse, choisissez Localisation > Autoriser, puis reessayez.";
    }

    if (message.includes('timeout')) {
      return "La position GPS prend trop de temps. Activez le GPS, rapprochez-vous d'une zone couverte, puis reessayez.";
    }

    if (message.includes('unavailable')) {
      return "La geolocalisation n'est pas disponible sur cet appareil. Activez le GPS ou utilisez un navigateur compatible.";
    }

    if (message.includes('outside Senegal')) {
      return 'La position detectee est hors du Senegal. Verifiez le GPS avant de demarrer le trajet.';
    }

    if (message.includes('Invalid geolocation coordinates')) {
      return 'La position GPS recue est invalide. Activez la localisation precise puis reessayez.';
    }

    return "Impossible de recuperer votre position exacte. Autorisez la localisation GPS du navigateur et reessayez.";
  }

  private resolveCurrentLocation(fallbackLabel: string): Promise<{
    latitude: number;
    longitude: number;
    accuracyMeters?: number | null;
    headingDegrees?: number | null;
    speedKmh?: number | null;
    locationLabel?: string | null;
  }> {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      return Promise.reject(new Error('Geolocation unavailable'));
    }

    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          if (
            !Number.isFinite(position.coords.latitude) ||
            !Number.isFinite(position.coords.longitude)
          ) {
            reject(new Error('Invalid geolocation coordinates'));
            return;
          }

          if (!this.isCoordinateInSenegal(position.coords.latitude, position.coords.longitude)) {
            this.resolveEstimatedTravelerLocation(fallbackLabel)
              .then(resolve)
              .catch(() => reject(new Error('Geolocation outside Senegal')));
            return;
          }

          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracyMeters: position.coords.accuracy,
            headingDegrees:
              typeof position.coords.heading === 'number' ? position.coords.heading : null,
            speedKmh:
              typeof position.coords.speed === 'number' ? position.coords.speed * 3.6 : null,
            locationLabel: fallbackLabel,
          });
        },
        (error) => {
          if (error.code === error.PERMISSION_DENIED) {
            reject(new Error('Geolocation permission denied'));
            return;
          }

          if (error.code === error.POSITION_UNAVAILABLE) {
            reject(new Error('Geolocation unavailable'));
            return;
          }

          if (error.code === error.TIMEOUT) {
            reject(new Error('Geolocation timeout'));
            return;
          }

          reject(new Error('Geolocation unavailable'));
        },
        { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 },
      );
    });
  }

  private async resolveEstimatedTravelerLocation(fallbackLabel: string): Promise<{
    latitude: number;
    longitude: number;
    accuracyMeters?: number | null;
    headingDegrees?: number | null;
    speedKmh?: number | null;
    locationLabel?: string | null;
  }> {
    const appointment = this.appointment();
    if (!appointment || !this.clientTravelsToProvider()) {
      throw new Error('Estimated location unavailable');
    }

    const address = appointment.addressLabel.trim();
    if (!address) {
      throw new Error('Estimated location unavailable');
    }

    const result = await firstValueFrom(this.appointmentsService.geocodeAddress(address));
    if (!result || !this.isCoordinateInSenegal(result.latitude, result.longitude)) {
      throw new Error('Estimated location unavailable');
    }

    return {
      latitude: result.latitude,
      longitude: result.longitude,
      accuracyMeters: null,
      headingDegrees: null,
      speedKmh: null,
      locationLabel: `${fallbackLabel} estimee depuis l'adresse de depart`,
    };
  }
}

