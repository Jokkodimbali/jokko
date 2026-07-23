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
import { Observable, Subscription, catchError, merge, of, switchMap, timer } from 'rxjs';
import { AuthSessionService } from '../../../../../core/auth/auth-session.service';
import { AppFeedbackService } from '../../../../../core/feedback/app-feedback.service';
import { BackNavigationService } from '../../../../../core/navigation/back-navigation.service';
import { safeInternalUrl } from '../../../../../shared/utils/safe-internal-url';
import { userInitials } from '../../../../../shared/utils/user-initials';
import { getHttpErrorMessage } from '../../../../../core/http/api-response.utils';
import { MessagesService } from '../../../../messages/data-access/messages.service';
import { AppointmentsService } from '../../../data-access/appointments.service';
import {
  AppointmentTrackingView,
  AppointmentVehicleType,
  AppointmentView,
  MedicalPrescriptionPayload,
} from '../../../domain/appointments.models';
import { AppointmentDetailLoadingComponent } from '../../components/appointment-detail-loading/appointment-detail-loading.component';
import { AppointmentDetailFormatService } from './appointment-detail-format.service';
import { AppointmentDocumentBuilderService } from './appointment-document-builder.service';
import { AppointmentDocumentRendererService } from './appointment-document-renderer.service';
import { AppointmentGeoService } from './appointment-geo.service';
import { AppointmentMedicalPrescriptionService } from './appointment-medical-prescription.service';
import { AppointmentNavigationService } from './appointment-navigation.service';
import {
  AppointmentRouteAlternativeView,
  AppointmentRouteOption,
  AppointmentRouteService,
} from './appointment-route.service';
import {
  AppointmentTrackingStep,
  AppointmentTrackingStepperComponent,
} from '../../components/appointment-tracking-stepper/appointment-tracking-stepper.component';
import { ProviderLocationService } from '../../../../tracking/data-access/provider-location.service';
import { TrackingRealtimeService } from '../../../../tracking/data-access/tracking-realtime.service';
import { TrackingGoogleMapRendererService } from '../../../../tracking/presentation/tracking-google-map-renderer.service';
import { TrackingArrivalStateService } from '../../../../tracking/state/tracking-arrival-state.service';
import { TrackingScenarioStateService } from '../../../../tracking/state/tracking-scenario-state.service';
import { TrackingScenarioViewContext } from '../../../../tracking/state/scenarios/tracking-scenario.types';
import { TrackingStore } from '../../../../tracking/state/tracking.store';

type MapCoordinate = { lat: number; lng: number };
type TrackingStepView = AppointmentTrackingStep;
type MedicalRecordKind = 'act' | 'vaccine' | 'treatment';
type MedicalPrescriptionPreviewItem = {
  label: string;
  text: string;
};
type ParcelCheckpoint = 'RETRAIT' | 'DEPOT';

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
const ARRIVAL_DISTANCE_THRESHOLD_METERS = 120;
const TRACKING_FALLBACK_POLL_INTERVAL_MS = 2500;
const APPOINTMENT_STATE_FALLBACK_INITIAL_DELAY_MS = 400;
const APPOINTMENT_STATE_FALLBACK_INTERVAL_MS = 2500;
const LIVE_LOCATION_UPDATE_INTERVAL_MS = 2000;
const ROUTE_DEVIATION_THRESHOLD_METERS = 45;
const ROUTE_DEVIATION_RECALCULATION_COOLDOWN_MS = 5_000;
const MAP_PERSPECTIVE_STORAGE_KEY = 'jokko-appointment-map-perspective';
const PARCEL_VEHICLE_MARKERS: Record<
  AppointmentVehicleType,
  { imageUrl: string; label: string }
> = {
  MOTO_SCOOTER: {
    imageUrl: 'https://res.cloudinary.com/dobuolool/image/upload/jokko/vehicle-assets/moto.png',
    label: 'Moto / Scooter',
  },
  VOITURE: {
    imageUrl: 'https://res.cloudinary.com/dobuolool/image/upload/jokko/vehicle-assets/voiture.png',
    label: 'Voiture',
  },
  CAMIONNETTE: {
    imageUrl: 'https://res.cloudinary.com/dobuolool/image/upload/jokko/vehicle-assets/camionnette.png',
    label: 'Camionnette',
  },
};

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
  providers: [
    TrackingStore,
    TrackingGoogleMapRendererService,
    TrackingArrivalStateService,
    TrackingScenarioStateService,
  ],
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
  private readonly arrivalState = inject(TrackingArrivalStateService);
  private readonly trackingScenario = inject(TrackingScenarioStateService);
  private readonly mapRenderer = inject(TrackingGoogleMapRendererService);
  private readonly formatter = inject(AppointmentDetailFormatService);
  private readonly geo = inject(AppointmentGeoService);
  private readonly navigationService = inject(AppointmentNavigationService);
  private readonly routeService = inject(AppointmentRouteService);
  private readonly documentBuilder = inject(AppointmentDocumentBuilderService);
  private readonly documentRenderer = inject(AppointmentDocumentRendererService);
  private readonly medicalPrescriptionService = inject(AppointmentMedicalPrescriptionService);
  private trackingSubscription?: Subscription;
  private missionSubscription?: Subscription;
  private connectionSubscription?: Subscription;
  private appointmentStatePollingSubscription?: Subscription;
  private providerLocationSubscription?: Subscription;
  private elapsedClockInterval?: number;
  private routeCoordinates: Array<[number, number]> = [];
  private routeOptions: AppointmentRouteOption[] = [];
  private routeCoordinatesKey = '';
  private routeRequestBlockedUntilMs = 0;
  private routeDeviationRecalculationBlockedUntilMs = 0;
  private trackingMapElement?: HTMLElement;
  private lastResolvedDestinationAddress = '';
  private isAnimatingRouteArrival = false;
  private locationSharingBlockedUntilMs = 0;
  private readonly refreshParcelCheckpoints = (): void => {
    this.parcelCheckpointVersion.update((version) => version + 1);
    const appointment = this.appointment();
    if (appointment && this.isParcelTransportAppointment(appointment)) {
      this.prepareParcelDropoffNavigationAfterPickup(appointment);
    }
  };

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
  protected readonly isReviewModalOpen = signal(false);
  protected readonly isReviewSuccessModalOpen = signal(false);
  protected readonly rescheduleDateTime = signal('');
  protected readonly priceAdjustmentForm = {
    proposedPrice: 0,
    reason: '',
  };
  protected readonly isSubmittingReview = signal(false);
  protected readonly reviewComment = signal('');
  protected readonly destinationCoordinates = signal<MapCoordinate | null>(null);
  protected readonly routeDistanceKm = signal<number | null>(null);
  protected readonly routeDurationMinutes = signal<number | null>(null);
  protected readonly routeStatus = signal<'idle' | 'calculating' | 'ready' | 'unavailable'>('idle');
  protected readonly isSatelliteMapEnabled = signal(false);
  protected readonly isMapFullscreen = signal(false);
  protected readonly isMapTopView = signal(false);
  protected readonly isNavigationVoiceEnabled = signal(true);
  protected readonly mapHeadingDegrees = signal(0);
  protected readonly selectedRouteId = signal('route-0');
  protected readonly routeAlternatives = signal<AppointmentRouteAlternativeView[]>([]);
  protected readonly routeActorArrivalConfirmed = signal(false);
  protected readonly parcelCheckpointVersion = signal(0);
  protected readonly medicalActs = signal<string[]>([]);
  protected readonly medicalVaccines = signal<string[]>([]);
  protected readonly medicalTreatments = signal<string[]>([]);
  protected readonly currentMedicalAct = signal('');
  protected readonly currentMedicalVaccine = signal('');
  protected readonly currentMedicalTreatment = signal('');
  protected readonly isPrescriptionPreviewOpen = signal(false);
  protected readonly medicalPrescriptionPreviewItems = computed<MedicalPrescriptionPreviewItem[]>(() => [
    ...this.medicalTreatments().map((text) => ({ label: 'Traitement', text })),
    ...this.medicalVaccines().map((text) => ({ label: 'Vaccin administre', text })),
    ...this.medicalActs().map((text) => ({ label: 'Acte medical', text })),
  ]);
  protected readonly commonMedicalActs = COMMON_MEDICAL_ACTS;
  protected readonly commonVaccines = COMMON_VACCINES;
  protected readonly commonTreatments = COMMON_TREATMENTS;
  protected readonly destinationStatus = signal<'idle' | 'resolving' | 'ready' | 'unavailable'>(
    'idle',
  );
  protected readonly selectedRating = signal(0);
  protected readonly reviewStars = [1, 2, 3, 4, 5];
  protected readonly reviewCommentLength = computed(() => this.reviewComment().length);
  protected readonly canSubmitReview = computed(() => {
    const comment = this.reviewComment().trim();
    return (
      this.selectedRating() > 0 &&
      comment.length > 0 &&
      comment.length <= 500 &&
      !this.isSubmittingReview()
    );
  });
  protected readonly hasPendingPriceAdjustment = computed(() => {
    const appointment = this.appointment();
    return (
      appointment?.priceAdjustmentStatus === 'EN_ATTENTE_CLIENT' &&
      typeof appointment.proposedAdjustedPrice === 'number' &&
      Number.isFinite(appointment.proposedAdjustedPrice)
    );
  });
  protected readonly isClientViewer = computed(() => {
    const appointment = this.appointment();
    const currentUserId = this.currentUser()?.id;
    return !!appointment && !!currentUserId && appointment.clientId === currentUserId;
  });
  protected readonly isProviderViewer = computed(() => {
    const appointment = this.appointment();
    const currentUserId = this.currentUser()?.id;
    if (!appointment || !currentUserId || this.isClientViewer()) return false;

    return appointment.professionalUserId === currentUserId;
  });
  protected readonly isDoctorViewer = computed(
    () => this.isProviderViewer() && this.currentUser()?.role === 'MEDECIN',
  );
  protected readonly isMedicalAppointment = computed(() => {
    const appointment = this.appointment();
    if (!appointment) return false;
    if (this.isDoctorViewer()) return true;

    const searchable = [
      appointment.serviceCategoryName,
      appointment.specialty,
      appointment.serviceName,
      appointment.serviceDescription,
    ]
      .filter((value): value is string => Boolean(value?.trim()))
      .map((value) => this.normalizeTextForMatch(value))
      .join(' ');

    return /\b(sante|medical|medecin|consultation|clinique|soin|patient)\b/.test(searchable);
  });
  protected readonly canManageProviderStatus = computed(() => {
    const appointment = this.appointment();
    return (
      this.isProviderViewer() &&
      !!appointment &&
      !this.isTerminalAppointmentStatus(appointment.status)
    );
  });
  protected readonly canCancelAppointment = computed(() => {
    const status = this.appointment()?.status;
    return !!status && !this.isTerminalAppointmentStatus(status);
  });
  protected readonly minRescheduleDateTime = computed(() =>
    this.formatter.toDateTimeLocalValue(new Date(Date.now() + 15 * 60 * 1000)),
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
    this.formatter.formatCurrency(this.appointment()?.agreedPrice ?? 0),
  );
  protected readonly finalPriceLabel = computed(() => {
    const appointment = this.appointment();
    return this.formatter.formatCurrency(
      appointment?.proposedAdjustedPrice ?? appointment?.agreedPrice ?? 0,
    );
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
    this.formatter.formatCurrency(this.medicalTotalAmount()),
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
    return this.formatter.formatTimeFromValue(
      tracking?.endedAt ||
        tracking?.updatedAt ||
        tracking?.lastPositionAt ||
        appointment?.scheduledAt,
    );
  });
  protected readonly completedPaymentLabel = computed(() => {
    const tracking = this.tracking();
    const appointment = this.appointment();
    return `Paiement confirme le ${this.formatter.formatLongDateTime(
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
    this.formatter.formatCurrency(this.appointment()?.proposedAdjustedPrice ?? 0),
  );
  protected readonly priceAdjustmentDeltaLabel = computed(() => {
    const appointment = this.appointment();
    const currentPrice = appointment?.agreedPrice ?? 0;
    const proposedPrice = appointment?.proposedAdjustedPrice ?? 0;
    const delta = proposedPrice - currentPrice;
    const sign = delta >= 0 ? '+' : '-';
    return `${sign} ${this.formatter.formatCurrency(Math.abs(delta))}`;
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

    return !this.isProviderWorking() && this.hasConfirmedRouteStart();
  });
  protected readonly canShowProviderStartAction = computed(
    () =>
      this.isProviderViewer() &&
      !this.isAppointmentCompleted() &&
      !this.isProviderWorking() &&
      (this.clientTravelsToProvider()
        ? this.hasTravelerArrivalConfirmation()
        : this.isProviderOnTheWay() && this.hasTravelerArrivedAtDestination()),
  );
  protected readonly isOperationalServiceDay = computed(() => {
    const appointment = this.appointment();
    return (
      !!appointment &&
      !this.isAppointmentCompleted() &&
      !this.isAppointmentClosed() &&
      this.canShowLiveTracking(appointment) &&
      (appointment.status === 'PAYEE_SEQUESTRE' || appointment.status === 'EN_COURS')
    );
  });
  protected readonly shouldShowOperationalMap = computed(
    () =>
      this.isProviderOnTheWay() ||
      this.hasTravelerArrivalConfirmation() ||
      this.isParcelDropoffNavigationActive(),
  );
  protected readonly hasActiveTrackingNavigation = computed(
    () =>
      !this.isAppointmentCompleted() &&
      (this.hasConfirmedRouteStart() ||
        this.trackingIndicatesArrival(this.tracking()) ||
        this.isArrivalPinned()),
  );
  protected readonly activeTrackingScenario = computed(() =>
    this.trackingScenario.scenarioFor(this.appointment(), this.isMedicalAppointment()),
  );
  protected readonly providerTravelsToClient = computed(() =>
    this.activeTrackingScenario().isProviderTraveler(),
  );
  protected readonly clientTravelsToProvider = computed(() =>
    this.activeTrackingScenario().isClientTraveler(),
  );
  protected readonly isParcelDeliveryFlow = computed(() =>
    this.activeTrackingScenario().isParcelDelivery(),
  );
  protected readonly isParcelPickupValidated = computed(() => {
    this.parcelCheckpointVersion();
    const appointment = this.appointment();
    return (
      !!appointment &&
      (this.isParcelCheckpointValidated(appointment, 'RETRAIT') ||
        appointment.status === 'EN_COURS' ||
        appointment.status === 'TERMINEE')
    );
  });
  protected readonly isParcelDropoffValidated = computed(() => {
    this.parcelCheckpointVersion();
    const appointment = this.appointment();
    return (
      !!appointment &&
      (this.isParcelCheckpointValidated(appointment, 'DEPOT') ||
        appointment.status === 'TERMINEE')
    );
  });
  protected readonly parcelPickupAddress = computed(() => {
    const appointment = this.appointment();
    return this.extractAppointmentNoteValue(appointment?.notes ?? null, 'Depart colis') ?? '';
  });
  protected readonly parcelDropoffAddress = computed(() => {
    const appointment = this.appointment();
    return (
      this.extractAppointmentNoteValue(appointment?.notes ?? null, 'Arrivee destinataire') ??
      appointment?.addressLabel ??
      ''
    );
  });
  protected readonly isParcelDropoffNavigationActive = computed(
    () =>
      this.isParcelDeliveryFlow() &&
      this.isProviderWorking() &&
      !this.isParcelDropoffValidated() &&
      !this.isAppointmentCompleted(),
  );
  protected readonly isParcelAwaitingPickupScan = computed(
    () =>
      this.isParcelDeliveryFlow() &&
      this.isProviderOnTheWay() &&
      this.hasTravelerArrivedAtDestination() &&
      !this.isParcelPickupValidated(),
  );
  protected readonly isParcelAwaitingDropoffScan = computed(
    () =>
      this.isParcelDropoffNavigationActive() &&
      this.hasTravelerArrivedAtDestination() &&
      !this.isParcelDropoffValidated(),
  );
  protected readonly isRouteActorViewer = computed(() =>
    this.clientTravelsToProvider() ? !this.isProviderViewer() : this.isProviderViewer(),
  );
  protected readonly trackedTravelerName = computed(() => {
    return this.activeTrackingScenario().trackedTravelerName(this.appointment());
  });
  protected readonly trackedTravelerRoleLabel = computed(() =>
    this.activeTrackingScenario().trackedTravelerRoleLabel(),
  );
  protected readonly statusLabel = computed(() => {
    if (this.isAppointmentCompleted()) return 'Prestation terminee';
    if (this.hasTravelerArrivedAtDestination()) return 'Sur place';
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
        this.geo.isCoordinateInSenegal(latitude, longitude)
      );
    },
  );
  protected readonly canStartRouteToday = computed(() => {
    const appointment = this.appointment();
    return (
      !!appointment &&
      !this.isAppointmentCompleted() &&
      !this.isAppointmentClosed() &&
      appointment.status === 'PAYEE_SEQUESTRE'
    );
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
    () =>
      this.clientTravelsToProvider()
        ? this.routeActorArrivalConfirmed() ||
          this.isArrivalPinned() ||
          this.trackingHasExplicitClientArrival(this.tracking())
        : this.trackingIndicatesArrival(this.tracking()),
  );
  protected readonly hasTravelerArrivedAtDestination = computed(() => {
    this.arrivalState.version();
    if (this.isArrivalPinned()) return true;
    if (this.hasTravelerArrivalConfirmation()) return true;
    return false;
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

    if (this.isParcelTransportAppointment(appointment)) {
      return this.isParcelPickupValidated();
    }

    if (this.clientTravelsToProvider()) {
      return this.hasTravelerArrivedAtDestination();
    }

    return this.canStartRouteToday() && this.isProviderOnTheWay();
  });
  protected readonly canTravelerMarkArrived = computed(() => {
    const appointment = this.appointment();
    if (
      appointment &&
      this.isParcelTransportAppointment(appointment) &&
      this.isProviderViewer() &&
      this.isParcelDropoffNavigationActive()
    ) {
      return !this.hasTravelerArrivedAtDestination();
    }

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
    const isWorkStarted = appointment?.status === 'EN_COURS' || this.isProviderWorking();
    return (
      !!appointment &&
      this.canManageProviderStatus() &&
      isWorkStarted &&
      (!this.isParcelTransportAppointment(appointment) || this.isParcelDropoffValidated())
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
      this.isClientViewer() &&
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
      return `${this.formatter.formatDistance(serverDistance / 1000)} restants`;
    }
    const routeDistance = this.routeDistanceKm();
    if (routeDistance !== null && routeDistance > 0) {
      return `${this.formatter.formatDistance(routeDistance)} restants`;
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
    if (this.isProviderWorking() && !this.isParcelDropoffNavigationActive()) return 100;
    const minutes = this.estimatedArrivalMinutes();
    if (minutes <= 0) return 0;
    return Math.max(18, Math.min(82, 100 - minutes * 4));
  });
  protected readonly routeProgressLabel = computed(() => `${this.routeProgress()}%`);
  private parcelTrackingStepIndex(): number {
    if (this.isAppointmentCompleted() || this.isParcelDropoffValidated()) return 4;
    if (this.isParcelAwaitingDropoffScan()) return 4;
    if (this.isParcelDropoffNavigationActive()) return 3;
    if (this.isParcelAwaitingPickupScan() || this.isParcelPickupValidated()) return 2;
    if (this.isProviderOnTheWay() || this.hasConfirmedRouteStart()) return 1;
    return 0;
  }

  protected readonly trackingCurrentStepIndex = computed(() => {
    if (this.isAppointmentCompleted()) return 3;
    if (this.isParcelDeliveryFlow()) {
      return this.parcelTrackingStepIndex();
    }
    if (this.isProviderWorking() || this.appointment()?.status === 'EN_COURS') return 2;
    if (this.isProviderOnTheWay() || this.hasConfirmedRouteStart()) return 1;
    return 0;
  });
  protected readonly trackingStepProgress = computed(() =>
    Math.round((this.trackingCurrentStepIndex() / (this.isParcelDeliveryFlow() ? 4 : 3)) * 100),
  );
  protected readonly trackingTimelineSteps = computed<TrackingStepView[]>(() => {
    const activeIndex = this.trackingCurrentStepIndex();
    const steps = this.activeTrackingScenario().clientTimelineSteps(this.trackingScenarioContext());
    return steps.map((step, index) => ({
      ...step,
      state: index < activeIndex ? 'done' : index === activeIndex ? 'active' : 'pending',
    }));
  });
  protected readonly providerTrackingCurrentStepIndex = computed(() => {
    if (this.isAppointmentCompleted()) return 3;
    if (this.isParcelDeliveryFlow()) {
      return this.parcelTrackingStepIndex();
    }
    if (this.isProviderWorking() || this.appointment()?.status === 'EN_COURS') return 2;
    if (this.isProviderOnTheWay() || this.hasConfirmedRouteStart()) return 1;
    return 0;
  });
  protected readonly providerTrackingStepProgress = computed(() =>
    Math.round((this.providerTrackingCurrentStepIndex() / (this.isParcelDeliveryFlow() ? 4 : 3)) * 100),
  );
  protected readonly providerTrackingTimelineSteps = computed<TrackingStepView[]>(() => {
    const activeIndex = this.providerTrackingCurrentStepIndex();
    const steps = this.activeTrackingScenario().providerTimelineSteps(this.trackingScenarioContext());
    return steps.map((step, index) => ({
      ...step,
      state: index < activeIndex ? 'done' : index === activeIndex ? 'active' : 'pending',
    }));
  });
  protected readonly providerConsoleEyebrow = computed(() => {
    if (this.isAppointmentCompleted()) return 'Mission cloturee';
    if (this.isParcelDeliveryFlow() && this.isParcelAwaitingPickupScan()) return "Arrive chez l'expediteur";
    if (this.isParcelDeliveryFlow() && this.isParcelAwaitingDropoffScan()) return 'Arrive chez le destinataire';
    if (this.isParcelDropoffNavigationActive()) return 'Navigation vers le destinataire';
    if (this.isProviderWorking()) return 'Temps de travail ecoule';
    if (this.isProviderOnTheWay()) return `Navigation vers ${this.clientFirstNameLabel()}`;
    return this.activeTrackingScenario().providerIdleEyebrow();
  });
  protected readonly providerConsoleTitle = computed(() => {
    const appointment = this.appointment();
    if (this.isAppointmentCompleted()) return 'Mission terminee';
    if (this.isParcelDeliveryFlow() && this.isParcelAwaitingPickupScan()) return "Sur place chez l'expediteur";
    if (this.isParcelDeliveryFlow() && this.isParcelAwaitingDropoffScan()) return 'Sur place chez le destinataire';
    if (this.isParcelDropoffNavigationActive()) return this.routeEtaLabel();
    if (this.isProviderWorking()) return this.providerElapsedWorkLabel();
    if (this.isProviderOnTheWay()) return this.routeEtaLabel();
    return appointment?.timeLabel ?? '--h--';
  });
  protected readonly providerConsoleDescription = computed(() => {
    if (this.isAppointmentCompleted()) {
      return `${this.finalPriceLabel()} a ete declenche. Le client recevra sa facture PDF immediatement.`;
    }
    if (this.isParcelDeliveryFlow()) {
      if (this.isParcelAwaitingPickupScan()) {
        return "Vous etes chez l'expediteur. La camera va scanner le QR retrait pour confirmer la prise en charge.";
      }
      if (this.isParcelAwaitingDropoffScan()) {
        return 'Vous etes chez le destinataire. La camera va scanner le QR depot pour confirmer la livraison.';
      }
      if (this.isParcelDropoffNavigationActive()) {
        return 'Vous etes en route vers le destinataire. Confirmez votre arrivee une fois sur place.';
      }
      if (this.isProviderOnTheWay()) {
        return "Vous etes en route vers l'expediteur pour recuperer le colis.";
      }
      return 'Demarrez la livraison pour partager votre position et rejoindre le point de retrait.';
    }
    if (this.isProviderWorking()) {
      return this.appointment()?.serviceName ?? 'Intervention en cours';
    }
    if (this.isProviderOnTheWay()) {
      return this.navigationInstruction().instruction;
    }
    return this.activeTrackingScenario().providerIdleDescription();
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
    if (this.isParcelDeliveryFlow()) {
      if (this.isParcelAwaitingPickupScan()) return 'Scanner le QR retrait';
      if (this.isParcelPickupValidated() && !this.isProviderWorking()) {
        return 'Partir livrer le colis';
      }
      if (this.isParcelAwaitingDropoffScan()) return 'Scanner le QR depot';
      if (this.isParcelDropoffValidated()) return 'Livraison terminee';
      if (this.isParcelDropoffNavigationActive()) return 'Sur place';
      if (this.isProviderOnTheWay()) return 'Sur place';
      return 'Commencer la livraison';
    }
    if (this.isProviderWorking()) return "Cloturer l'intervention";
    if (this.clientTravelsToProvider() && this.hasTravelerArrivalConfirmation()) {
      return 'Commencer la prestation';
    }
    if (this.isProviderOnTheWay()) {
      return this.activeTrackingScenario().providerOnTheWayActionLabel(
        this.trackingScenarioContext(),
      );
    }
    if (this.canMarkTravelerOnTheWay()) return 'Demarrer le trajet';
    return this.activeTrackingScenario().providerWaitingActionLabel();
  });
  protected readonly canUseProviderPrimaryAction = computed(() => {
    if (this.isAppointmentCompleted()) return true;
    if (this.isParcelDeliveryFlow()) return this.canUseParcelActionButton();
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
    if (this.isParcelDeliveryFlow()) {
      if (this.isParcelAwaitingPickupScan() || this.isParcelAwaitingDropoffScan()) {
        return 'maximize-2';
      }
      if (this.isParcelDropoffValidated()) return 'check';
      if (this.isProviderOnTheWay() || this.isParcelDropoffNavigationActive()) return 'map-pin';
      return 'send';
    }
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
    return this.providerExpertiseLabel(appointment).toLocaleLowerCase('fr-FR');
  });
  protected readonly trackingScenarioContext = computed<TrackingScenarioViewContext>(() => ({
    appointmentCompleted: this.isAppointmentCompleted(),
    providerWorking: this.isProviderWorking(),
    providerOnTheWay: this.isProviderOnTheWay(),
    travelerArrived: this.hasTravelerArrivedAtDestination(),
    parcelPickupValidated: this.isParcelPickupValidated(),
    parcelDropoffValidated: this.isParcelDropoffValidated(),
    parcelDropoffNavigationActive: this.isParcelDropoffNavigationActive(),
    parcelAwaitingPickupScan: this.isParcelAwaitingPickupScan(),
    parcelAwaitingDropoffScan: this.isParcelAwaitingDropoffScan(),
    routeEtaLabel: this.routeEtaLabel(),
    clientFirstName: this.clientFirstNameLabel(),
    providerFirstName: this.providerFirstNameLabel(),
    providerRole: this.providerRoleLabel(),
    travelerName: this.trackedTravelerName(),
  }));
  protected readonly clientTrackingTitle = computed(() =>
    this.activeTrackingScenario().clientTrackingTitle(this.trackingScenarioContext()),
  );
  protected readonly clientTrackingDescription = computed(() =>
    this.activeTrackingScenario().clientTrackingDescription(this.trackingScenarioContext()),
  );
  protected readonly routeRemainingBadgeLabel = computed(() => {
    if (this.hasTravelerArrivedAtDestination()) return 'Sur place';
    if (this.isProviderWorking() && !this.isParcelDropoffNavigationActive()) return 'Arrive';
    const distance = this.routeDistanceKm();
    const minutes = this.routeDurationMinutes();
    if (distance !== null && distance > 0) return this.formatter.formatDistance(distance);
    if (minutes !== null && minutes > 0) return `${minutes} min`;
    return 'GPS';
  });
  protected readonly routeEtaLabel = computed(() => {
    if (this.hasTravelerArrivedAtDestination()) return 'Sur place';
    if (this.isProviderWorking() && !this.isParcelDropoffNavigationActive()) return 'Arrive';
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
    if (this.hasTravelerArrivedAtDestination()) return 'Sur place';
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
    if (this.isParcelDeliveryFlow() && this.hasTravelerArrivedAtDestination()) {
      return {
        instruction: this.parcelArrivedVehicleStatusLabel(),
        maneuver: 'ARRIVE',
        distanceMeters: 0,
      };
    }
    if (this.isProviderWorking() && !this.isParcelDropoffNavigationActive()) {
      return {
        instruction: `Vous etes arrive a destination de ${this.arrivalDestinationLabelFromCurrentAppointment()}.`,
        maneuver: 'ARRIVE',
        distanceMeters: 0,
      };
    }

    const route = this.routeOptions.find(
      (option) => option.id === this.selectedRouteId(),
    );
    const step = this.navigationService.findUpcomingStep(
      route?.navigationSteps ?? [],
      (destination) => this.distanceMetersBetweenCurrentPosition(destination),
    );
    return step
      ? {
          instruction: this.navigationService.normalizeInstruction(step),
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
    return this.navigationDistanceText(distance);
  });
  protected readonly navigationManeuverIcon = computed(() => {
    return this.navigationManeuverIconFor(this.navigationInstruction().maneuver);
  });
  protected readonly upcomingNavigationManeuvers = computed(() => {
    const route = this.routeOptions.find(
      (option) => option.id === this.selectedRouteId(),
    );
    if (!route) return [];

    return route.navigationSteps
      .map((step) => {
        const distance =
          step.end ? this.distanceMetersBetweenCurrentPosition(step.end) : step.distanceMeters;
        return { step, distance };
      })
      .filter(
        (item): item is { step: (typeof route.navigationSteps)[number]; distance: number } =>
          typeof item.distance === 'number' &&
          Number.isFinite(item.distance) &&
          item.distance > 25,
      )
      .sort((left, right) => left.distance - right.distance)
      .slice(0, 3)
      .map(({ step, distance }) => ({
        id: step.id,
        icon: this.navigationManeuverIconFor(step.maneuver),
        label: this.navigationService.normalizeInstruction(step),
        distanceLabel: this.navigationDistanceText(distance),
      }));
  });

  protected navigationManeuverIconFor(maneuverValue: string | null | undefined): string {
    const maneuver = maneuverValue?.toUpperCase() ?? '';
    if (maneuver.includes('LEFT')) return 'corner-up-left';
    if (maneuver.includes('RIGHT')) return 'corner-up-right';
    if (maneuver.includes('UTURN')) return 'rotate-ccw';
    if (maneuver.includes('ROUNDABOUT')) return 'refresh-cw';
    if (maneuver.includes('MERGE')) return 'git-merge';
    if (maneuver.includes('FORK')) return 'split';
    return 'move-up';
  }

  private navigationDistanceText(distance: number): string {
    return distance < 1000
      ? `${Math.max(10, Math.round(distance / 10) * 10)} m`
      : this.formatter.formatDistance(distance / 1000);
  }

  protected trackByNavigationManeuver(
    _index: number,
    maneuver: { id: string },
  ): string {
    return maneuver.id;
  }
  protected readonly arrivedAtLabel = computed(() => {
    const tracking = this.tracking();
    return this.formatter.formatTimeFromValue(
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
    return this.formatter.formatTimeFromDate(startDate);
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
  protected readonly shouldRenderTrackingMap = computed(
    () => {
      const hasArrival = this.hasTravelerArrivedAtDestination();
      const hasLivePosition =
        this.hasActiveTrackingNavigation() && this.hasTrackingCoordinates();
      return (
        !this.isAppointmentCompleted() &&
        (this.isParcelDeliveryFlow() || !this.isProviderWorking()) &&
        (hasArrival ||
          (hasLivePosition &&
            (this.isProviderOnTheWay() || this.isParcelDropoffNavigationActive())))
      );
    },
  );
  protected readonly showProviderConsoleVisual = computed(
    () =>
      this.isProviderViewer() &&
      !this.isProviderOnTheWay() &&
      !this.isParcelDropoffNavigationActive(),
  );
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

    const rawItems = [this.displayableAppointmentNotes(appointment), appointment.serviceDescription]
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
    this.restoreMapPerspective();
    this.elapsedClockInterval = window.setInterval(() => {
      this.nowMs.set(Date.now());
    }, 1000);
    window.addEventListener('focus', this.refreshParcelCheckpoints);
    window.addEventListener('storage', this.refreshParcelCheckpoints);
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
    window.removeEventListener('focus', this.refreshParcelCheckpoints);
    window.removeEventListener('storage', this.refreshParcelCheckpoints);
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
      this.displayableAppointmentNotes(appointment) ||
      appointment.serviceDescription?.trim() ||
      'Aucune note particuliere n a ete ajoutee a ce rendez-vous.'
    );
  }

  protected displayableAppointmentNotes(appointment: AppointmentView): string {
    return this.medicalPrescriptionService.stripFromNotes(appointment.notes).trim();
  }

  protected canReviewAppointment(appointment: AppointmentView): boolean {
    return (
      this.isClientViewer() &&
      appointment.status === 'TERMINEE' &&
      !appointment.clientReviewedAt
    );
  }

  protected openReviewModal(appointment: AppointmentView): void {
    if (!this.canReviewAppointment(appointment)) return;

    this.selectedRating.set(appointment.clientRating ?? 0);
    this.reviewComment.set(appointment.clientReview ?? '');
    this.isReviewSuccessModalOpen.set(false);
    this.isReviewModalOpen.set(true);
  }

  protected closeReviewModal(): void {
    if (this.isSubmittingReview()) return;
    this.isReviewModalOpen.set(false);
  }

  protected closeReviewSuccessModal(): void {
    this.isReviewSuccessModalOpen.set(false);
  }

  protected setRating(rating: number): void {
    this.selectedRating.set(rating);
  }

  protected updateReviewComment(value: string): void {
    this.reviewComment.set(value.slice(0, 500));
  }

  protected submitReview(appointment: AppointmentView): void {
    const currentAppointment = this.appointment() ?? appointment;
    const rating = this.selectedRating();
    const review = this.reviewComment().trim();
    if (
      !currentAppointment ||
      !this.canReviewAppointment(currentAppointment) ||
      !this.canSubmitReview() ||
      rating <= 0 ||
      review.length === 0
    ) {
      return;
    }

    this.isSubmittingReview.set(true);
    this.appointmentsService.submitReview(currentAppointment.id, rating, review).subscribe({
      next: (updated) => {
        this.appointment.update((current) =>
          this.mergeAppointment(current ?? currentAppointment, updated),
        );
        this.isSubmittingReview.set(false);
        this.isReviewModalOpen.set(false);
        this.isReviewSuccessModalOpen.set(true);
      },
      error: () => {
        this.selectedRating.set(currentAppointment.clientRating ?? 0);
        this.reviewComment.set(currentAppointment.clientReview ?? '');
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
    this.persistMedicalPrescriptionDraft();
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
    this.persistMedicalPrescriptionDraft();
    this.feedback.info('Element retire du dossier medical.');
  }

  protected medicalPrescriptionPatientName(appointment: AppointmentView): string {
    return (
      this.extractAppointmentNoteValue(appointment.notes, 'Patient') ||
      appointment.clientName ||
      'Client non renseigne'
    );
  }

  protected medicalPrescriptionPatientPhone(appointment: AppointmentView): string | null {
    return this.extractAppointmentNoteValue(appointment.notes, 'Telephone') || appointment.clientPhone;
  }

  protected openPrescriptionPreview(): void {
    this.isPrescriptionPreviewOpen.set(true);
  }

  protected closePrescriptionPreview(): void {
    this.isPrescriptionPreviewOpen.set(false);
  }

  protected downloadMedicalReceipt(appointment: AppointmentView): void {
    this.downloadHtmlDocument(
      `recu-medical-jokko-${appointment.id.slice(0, 8)}.pdf`,
      'Recu medical Jokko',
      this.buildMedicalReceiptHtml(appointment),
    );
    this.feedback.success('Recu medical genere.');
  }

  protected downloadMedicalPrescription(appointment: AppointmentView): void {
    const draftPrescription = this.currentMedicalPrescriptionPayload();
    if (
      this.isProviderViewer() &&
      this.isMedicalAppointment() &&
      this.medicalPrescriptionService.hasContent(draftPrescription)
    ) {
      this.appointmentsService
        .saveMedicalPrescription(appointment.id, draftPrescription)
        .pipe(
          catchError(() => of(null)),
          switchMap((updated) => {
            if (!updated) return this.loadAppointmentForDocument(appointment);
            this.appointment.update((current) =>
              current ? this.mergeMedicalPrescriptionUpdate(current, updated) : updated,
            );
            return this.loadAppointmentForDocument(
              this.mergeMedicalPrescriptionUpdate(this.appointment() ?? appointment, updated),
            );
          }),
        )
        .subscribe((source) => {
          this.downloadMedicalPrescriptionDocument(source, draftPrescription);
        });
      return;
    }

    this.loadAppointmentForDocument(appointment).subscribe((source) => {
      this.downloadMedicalPrescriptionDocument(
        source,
        this.medicalPrescriptionForDocument(source),
      );
    });
  }

  private loadAppointmentForDocument(fallback: AppointmentView): Observable<AppointmentView> {
    return this.appointmentsService.getAppointmentById(fallback.id).pipe(
      catchError(() => of(fallback)),
      switchMap((updated) => {
        this.appointment.update((current) =>
          current ? this.mergeAppointment(current, updated) : updated,
        );
        this.hydrateMedicalPrescriptionFromAppointment(updated);
        return of(updated);
      }),
    );
  }

  private downloadMedicalPrescriptionDocument(
    appointment: AppointmentView,
    prescription: MedicalPrescriptionPayload,
  ): void {
    this.downloadHtmlDocument(
      `ordonnance-jokko-${appointment.id.slice(0, 8)}.pdf`,
      'Ordonnance medicale Jokko',
      this.buildMedicalPrescriptionHtml(appointment, prescription),
    );
    this.feedback.success('Ordonnance medicale generee.');
  }

  protected downloadInvoice(appointment: AppointmentView): void {
    this.downloadHtmlDocument(
      `${this.invoiceNumberLabel().replace(/\s+/g, '-').toLowerCase()}.pdf`,
      'Facture mission Jokko',
      this.buildMissionInvoiceHtml(appointment),
    );
    this.feedback.success('Facture mission generee.');
  }

  protected syncAppointmentToCalendar(appointment: AppointmentView): void {
    const start = new Date(appointment.scheduledAt);
    if (Number.isNaN(start.getTime())) {
      this.feedback.error('Impossible de synchroniser ce rendez-vous : date invalide.');
      return;
    }

    const end = new Date(start.getTime() + Math.max(15, appointment.durationMinutes || 30) * 60000);
    const stamp = this.formatter.toCalendarDate(new Date());
    const lines = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Jokko//Reservation//FR',
      'BEGIN:VEVENT',
      `UID:${appointment.id}@jokko`,
      `DTSTAMP:${stamp}`,
      `DTSTART:${this.formatter.toCalendarDate(start)}`,
      `DTEND:${this.formatter.toCalendarDate(end)}`,
      `SUMMARY:${this.formatter.escapeCalendarText(appointment.serviceName)} avec ${this.formatter.escapeCalendarText(appointment.doctorName)}`,
      `LOCATION:${this.formatter.escapeCalendarText(appointment.addressLabel)}`,
      `DESCRIPTION:${this.formatter.escapeCalendarText(this.displayableAppointmentNotes(appointment) || 'Rendez-vous reserve sur Jokko Dimbali.')}`,
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
    const destination = encodeURIComponent(this.currentRouteDestinationAddress(appointment));

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
    scanMode = false,
  ): void {
    if (!this.isParcelTransportAppointment(appointment)) return;

    this.router.navigate(['/appointments', appointment.id, 'qr', type], {
      queryParams: { returnUrl: this.router.url, ...(scanMode ? { scan: '1' } : {}) },
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

  protected currentRouteDestinationAddress(appointment: AppointmentView): string {
    if (!this.isParcelTransportAppointment(appointment)) {
      if (this.clientTravelsToProvider()) {
        return appointment.professionalAddressLabel?.trim() || appointment.addressLabel;
      }
      return appointment.addressLabel;
    }

    const destination = this.isParcelPickupValidated()
      ? this.parcelDropoffAddress()
      : this.parcelPickupAddress();
    return destination?.trim() || appointment.addressLabel;
  }

  private currentRouteDestinationCoordinates(): MapCoordinate | null {
    const appointment = this.appointment();
    if (
      !appointment ||
      this.isParcelTransportAppointment(appointment) ||
      !this.clientTravelsToProvider()
    ) {
      return null;
    }

    const latitude = appointment.professionalLatitude;
    const longitude = appointment.professionalLongitude;
    if (
      typeof latitude !== 'number' ||
      typeof longitude !== 'number' ||
      !this.geo.isCoordinateInSenegal(latitude, longitude)
    ) {
      return null;
    }

    return { lat: latitude, lng: longitude };
  }

  protected parcelActionButtonLabel(): string {
    if (this.isParcelAwaitingPickupScan()) return "Scanner chez l'expediteur";
    if (this.isParcelPickupValidated() && !this.isProviderWorking()) {
      return 'Partir livrer le colis';
    }
    if (this.isParcelAwaitingDropoffScan()) return 'Scanner chez le destinataire';
    if (this.isParcelDropoffValidated()) return 'Livraison terminee';
    if (this.isParcelDropoffNavigationActive() || this.isProviderOnTheWay()) return 'Sur place';
    return 'Commencer la livraison';
  }

  protected canUseParcelActionButton(): boolean {
    const appointment = this.appointment();
    if (!appointment || !this.isProviderViewer() || this.isAppointmentCompleted()) {
      return false;
    }

    if (!this.isProviderOnTheWay() && !this.isProviderWorking()) {
      return this.canMarkTravelerOnTheWay();
    }
    if (this.isParcelAwaitingPickupScan() || this.isParcelAwaitingDropoffScan()) {
      return true;
    }
    if (this.isParcelPickupValidated() && !this.isProviderWorking()) {
      return this.canProviderStartWork();
    }
    if (this.isParcelDropoffValidated()) {
      return this.canProviderCompleteWork();
    }
    if (this.isParcelDropoffNavigationActive()) {
      return !this.hasTravelerArrivedAtDestination();
    }
    return this.isProviderOnTheWay() && !this.hasTravelerArrivedAtDestination();
  }

  private prepareParcelDropoffNavigationAfterPickup(appointment: AppointmentView): void {
    if (!this.isParcelTransportAppointment(appointment) || !this.isParcelPickupValidated()) {
      this.resolveDestinationCoordinates(this.currentRouteDestinationAddress(appointment));
      return;
    }

    this.routeActorArrivalConfirmed.set(false);
    this.arrivalState.clear(appointment.id);
    this.routeCoordinates = [];
    this.routeOptions = [];
    this.routeCoordinatesKey = '';
    this.routeAlternatives.set([]);
    this.routeDistanceKm.set(null);
    this.routeDurationMinutes.set(null);
    this.routeStatus.set('idle');
    this.mapRenderer.resetRoute();
    this.resolveDestinationCoordinates(this.currentRouteDestinationAddress(appointment));
    this.updateGoogleMaps();
  }

  private isParcelCheckpointValidated(
    appointment: AppointmentView,
    checkpoint: ParcelCheckpoint,
  ): boolean {
    if (typeof globalThis.localStorage === 'undefined') return false;
    return globalThis.localStorage.getItem(this.parcelCheckpointStorageKey(appointment, checkpoint)) === 'validated';
  }

  private parcelCheckpointStorageKey(
    appointment: AppointmentView,
    checkpoint: ParcelCheckpoint,
  ): string {
    return `jokko:parcel:${appointment.id}:${checkpoint}`;
  }

  private extractAppointmentNoteValue(notes: string | null, key: string): string | null {
    if (!notes) return null;
    const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(
      `${escapedKey}\\s*[:=-]\\s*(.*?)(?=\\.\\s+(?:Patient|Lien|Telephone|Lieu|Adresse selectionnee|Notes patient|Motif|Type de livraison|Expediteur|Depart colis|Destinataire|Arrivee destinataire|Distance estimee|Tarif kilometrique|Prix calcule|Colis\\s+\\d+|Note livraison)\\s*[:(]|$)`,
      'i',
    );
    const match = notes.match(pattern);
    return match?.[1]?.trim().replace(/\.$/, '').trim() || null;
  }

  protected arrivalDestinationLabel(appointment: AppointmentView): string {
    if (this.isParcelTransportAppointment(appointment)) {
      return this.isParcelPickupValidated()
        ? 'le destinataire'
        : "l'expediteur";
    }

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
    this.rescheduleDateTime.set(this.formatter.toDateTimeLocalValue(new Date(appointment.scheduledAt)));
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
      this.isUpdatingStatus.set(true);
      this.stopProviderLocationSharing();
      const destination = this.destinationCoordinates();
      this.pinArrival(destination);
      this.clearNavigationRouteAfterArrival();
      this.updateGoogleMaps();
      if (!destination) {
        this.isUpdatingStatus.set(false);
        this.feedback.success('Arrivee confirmee. Vous pouvez continuer la mission.');
        return;
      }

      this.appointmentsService
        .updateProviderTrackingLocation(appointment.id, {
          latitude: destination.lat,
          longitude: destination.lng,
          accuracyMeters: 20,
          headingDegrees: null,
          speedKmh: 0,
          locationLabel: `Arrive a destination de ${this.arrivalDestinationLabel(appointment)}`,
        })
        .subscribe({
          next: (tracking) => {
            this.setTrackingSafely(tracking);
            this.pinArrival(destination);
            this.clearNavigationRouteAfterArrival();
            this.updateGoogleMaps();
            this.refreshAppointmentAfterArrival(appointment.id);
            this.isUpdatingStatus.set(false);
            this.feedback.success('Arrivee confirmee. Vous pouvez continuer la mission.');
          },
          error: (error) => {
            if (error instanceof HttpErrorResponse && error.status === 409) {
              this.acceptLocalTravelerArrivalAfterTrackingConflict(appointment);
              return;
            }
            this.isUpdatingStatus.set(false);
            this.feedback.error("Impossible de confirmer l'arrivee pour le moment.");
          },
        });
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
          if (this.clientTravelsToProvider()) {
            this.routeActorArrivalConfirmed.set(false);
            this.arrivalState.clear(appointment.id);
          }
          this.setTrackingSafely(this.normalizeTrackingAfterTripStart(tracking));
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
        this.feedback.error(this.formatter.providerLocationHelpMessage(error));
      });
  }

  protected toggleSatelliteMap(): void {
    this.isSatelliteMapEnabled.update((enabled) => !enabled);
    this.mapRenderer.setSatellite(this.isSatelliteMapEnabled());
  }

  protected toggleMapPerspective(): void {
    if (!this.isRouteActorViewer()) return;

    this.isMapTopView.update((enabled) => !enabled);
    this.persistMapPerspective();
    this.mapRenderer.setTopView(this.isMapTopView());
    window.setTimeout(() => this.updateGoogleMaps(), 60);
  }

  private restoreMapPerspective(): void {
    if (typeof window === 'undefined') return;
    this.isMapTopView.set(
      window.localStorage.getItem(MAP_PERSPECTIVE_STORAGE_KEY) === 'top',
    );
  }

  private persistMapPerspective(): void {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(
      MAP_PERSPECTIVE_STORAGE_KEY,
      this.isMapTopView() ? 'top' : 'driver',
    );
  }

  private effectiveMapTopView(): boolean {
    return !this.isRouteActorViewer() || this.isMapTopView();
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
      this.navigationService.resetVoice();
      this.announceNavigationInstruction(true);
    } else {
      this.navigationService.cancelVoice();
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
          "Le suivi en route s'active apres confirmation et paiement de la reservation.",
        );
      }
      return;
    }

    this.isUpdatingStatus.set(true);
    this.routeActorArrivalConfirmed.set(false);
    this.arrivalState.clear(appointment.id);
    this.routeCoordinates = [];
    this.routeOptions = [];
    this.routeCoordinatesKey = '';
    this.routeAlternatives.set([]);
    this.routeDistanceKm.set(null);
    this.routeDurationMinutes.set(null);
    this.routeStatus.set('idle');
    this.mapRenderer.resetRoute();
    if (!silent) {
      this.feedback.info(
        "Partagez votre position GPS reelle pour activer le trajet automatiquement.",
      );
    }

    const location = await this.resolveCurrentLocation(this.trackedTravelerPositionLabel()).catch(
      (error) => {
        if (!silent) {
          this.feedback.error(this.formatter.providerLocationHelpMessage(error));
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
        this.setTrackingSafely(this.normalizeTrackingAfterTripStart(tracking));
        this.refreshAppointmentState(appointment.id);
        this.resolveDestinationCoordinates(this.currentRouteDestinationAddress(appointment));
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
        this.refreshAppointmentState(updated.id);
        this.refreshTracking(updated.id);
        if (this.isParcelTransportAppointment(updated)) {
          this.routeActorArrivalConfirmed.set(false);
          this.arrivalState.clear(updated.id);
          this.resolveDestinationCoordinates(this.currentRouteDestinationAddress(updated));
          this.stopProviderLocationSharing();
          this.startProviderLocationSharing(updated.id);
        } else {
          this.stopProviderLocationSharing();
        }
        this.isUpdatingStatus.set(false);
        if (!silent) {
          this.feedback.success(
            this.isParcelTransportAppointment(updated)
              ? 'Retrait confirme. Trajet vers le destinataire active.'
              : 'Prestation demarree.',
          );
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
    const prescription = this.isMedicalAppointment()
      ? this.currentMedicalPrescriptionPayload()
      : undefined;
    const hasPrescriptionToPersist =
      prescription !== undefined && this.medicalPrescriptionService.hasContent(prescription);
    const completion$ =
      this.isMedicalAppointment() && hasPrescriptionToPersist
        ? this.appointmentsService
            .saveMedicalPrescription(appointment.id, prescription)
            .pipe(
              catchError(() => of(null)),
              switchMap(() => this.appointmentsService.completeAppointment(appointment.id, prescription)),
            )
        : this.appointmentsService.completeAppointment(appointment.id, prescription);

    completion$.subscribe({
      next: (updated) => {
        this.appointment.update((current) =>
          this.mergeAppointment(current ?? appointment, updated),
        );
        this.hydrateMedicalPrescriptionFromAppointment(updated);
        this.synchronizeLiveNavigation(updated);
        this.loadTerminalTrackingSnapshot(appointment.id);
        this.refreshAppointmentState(appointment.id);
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
        this.hydrateMedicalPrescriptionFromAppointment(appointment);
        this.selectedRating.set(appointment.clientRating ?? 0);
        this.reviewComment.set(appointment.clientReview ?? '');
        this.isLoading.set(false);
        this.synchronizeLiveNavigation(appointment);
        if (appointment.status === 'TERMINEE') {
          this.loadTerminalTrackingSnapshot(appointment.id);
        } else if (!this.isTerminalStatus(appointment.status)) {
          this.resolveDestinationCoordinates(this.currentRouteDestinationAddress(appointment));
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
    return safeInternalUrl(this.route.snapshot.queryParamMap.get('returnUrl'));
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
        if (event.tracking) {
          this.setTrackingSafely(event.tracking);
        } else {
          this.refreshTracking(appointmentId);
        }
        this.refreshAppointmentState(appointmentId);
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
    this.navigationService.cancelVoice();
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
          const normalizedTracking = this.normalizeArrivedTravelerTracking(tracking);
          this.trackingStore.setTracking(normalizedTracking);
          this.syncAppointmentStatusFromTracking(normalizedTracking);
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
      this.resolveDestinationCoordinates(this.currentRouteDestinationAddress(appointment));
      return;
    }

    this.isUpdatingStatus.set(true);
    this.stopProviderLocationSharing();
    this.pinArrival(destination);
    this.clearNavigationRouteAfterArrival();
    this.mapRenderer.render({
      provider: destination,
      destination,
      destinationMarker: this.destinationMapMarker(),
      remainingLabel: 'Arrive',
      statusLabel: `Arrive a destination de ${this.arrivalDestinationLabel(appointment)}`,
      headingDegrees: this.reliableTrackingHeading(),
      routes: [],
      showManeuverMarkers: this.isRouteActorViewer(),
      arrived: true,
      travelerMarker: this.travelerMapMarker(),
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
    const current = this.appointment();
    const previousStatus = current?.status;
    const nextAppointment = current ? this.mergeAppointment(current, appointment) : appointment;
    this.appointment.set(nextAppointment);
    if (
      this.isParcelTransportAppointment(nextAppointment) &&
      nextAppointment.status === 'EN_COURS' &&
      previousStatus !== 'EN_COURS'
    ) {
      this.prepareParcelDropoffNavigationAfterPickup(nextAppointment);
    }
    this.synchronizeLiveNavigation(nextAppointment);
    if (nextAppointment.status === 'TERMINEE' && previousStatus !== 'TERMINEE') {
      this.loadTerminalTrackingSnapshot(nextAppointment.id);
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

    const path = this.routeAnimationPath({ lat: latitude, lng: longitude }, destination);
    if (path.length < 2) {
      return Promise.resolve();
    }

    this.isAnimatingRouteArrival = true;
    const startedAt = performance.now();
    const durationMs = 1600;
    const initialDistanceKm = this.routeDistanceKm();
    const initialDurationMinutes = this.routeDurationMinutes();

    return new Promise((resolve) => {
      const tick = (timestamp: number): void => {
        const progress = Math.min(1, (timestamp - startedAt) / durationMs);
        const eased = 1 - Math.pow(1 - progress, 3);
        const point = this.interpolateRoutePoint(path, eased);
        const remainingRatio = 1 - eased;

        this.routeDistanceKm.set(
          initialDistanceKm === null ? null : Math.max(0, initialDistanceKm * remainingRatio),
        );
        this.routeDurationMinutes.set(
          initialDurationMinutes === null
            ? null
            : Math.max(0, Math.round(initialDurationMinutes * remainingRatio)),
        );
        this.mapRenderer.render({
          provider: point,
          destination,
          destinationMarker: this.destinationMapMarker(),
          remainingLabel: progress >= 1 ? 'Arrive' : this.routeRemainingBadgeLabel(),
          statusLabel:
            progress >= 1
              ? `Arrive a destination de ${this.routeVehiclePersonLabel()}`
              : this.activeVehicleRouteLabel(false),
          headingDegrees: null,
          routes: this.serializedMapRoutes(),
          showManeuverMarkers: this.isRouteActorViewer(),
          arrived: progress >= 1,
          travelerMarker: this.travelerMapMarker(),
        });

        if (progress < 1) {
          this.requestRouteAnimationFrame(tick);
          return;
        }

        this.isAnimatingRouteArrival = false;
        resolve();
      };

      this.requestRouteAnimationFrame(tick);
    });
  }

  private routeAnimationPath(
    currentPosition: MapCoordinate,
    destination: MapCoordinate,
  ): MapCoordinate[] {
    const selectedRoute =
      this.routeOptions.find((route) => route.id === this.selectedRouteId()) ??
      this.routeOptions[0];
    const routeCoordinates = selectedRoute?.coordinates ?? this.routeCoordinates;
    const points = routeCoordinates.map(([lat, lng]) => ({ lat, lng }));
    if (points.length < 2) {
      return [currentPosition, destination];
    }

    let nearestIndex = 0;
    let nearestDistance = Number.POSITIVE_INFINITY;
    points.forEach((point, index) => {
      const distance =
        Math.pow(point.lat - currentPosition.lat, 2) +
        Math.pow(point.lng - currentPosition.lng, 2);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestIndex = index;
      }
    });

    const remainingRoute = points.slice(Math.min(nearestIndex + 1, points.length - 1));
    const lastPoint = remainingRoute[remainingRoute.length - 1];
    if (
      !lastPoint ||
      Math.abs(lastPoint.lat - destination.lat) > 0.00001 ||
      Math.abs(lastPoint.lng - destination.lng) > 0.00001
    ) {
      remainingRoute.push(destination);
    }

    return [currentPosition, ...remainingRoute];
  }

  private interpolateRoutePoint(path: MapCoordinate[], progress: number): MapCoordinate {
    if (path.length < 2) return path[0] ?? { lat: 0, lng: 0 };

    const segments = path.slice(1).map((point, index) => ({
      from: path[index],
      to: point,
      distance: this.geo.distanceMetersBetweenPoints(path[index], point),
    }));
    const totalDistance = segments.reduce((sum, segment) => sum + segment.distance, 0);
    if (totalDistance <= 0) return path[path.length - 1];

    let coveredDistance = Math.max(0, Math.min(1, progress)) * totalDistance;
    for (const segment of segments) {
      if (coveredDistance > segment.distance) {
        coveredDistance -= segment.distance;
        continue;
      }

      const ratio = segment.distance <= 0 ? 1 : coveredDistance / segment.distance;
      return {
        lat: segment.from.lat + (segment.to.lat - segment.from.lat) * ratio,
        lng: segment.from.lng + (segment.to.lng - segment.from.lng) * ratio,
      };
    }

    return path[path.length - 1];
  }

  private requestRouteAnimationFrame(callback: (timestamp: number) => void): void {
    if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
      window.requestAnimationFrame(callback);
      return;
    }

    window.setTimeout(() => callback(performance.now()), 16);
  }

  private acceptLocalTravelerArrivalAfterTrackingConflict(appointment: AppointmentView): void {
    this.locationSharingBlockedUntilMs = Date.now() + 30_000;
    this.stopProviderLocationSharing();
    this.pinArrival(this.destinationCoordinates());
    this.clearNavigationRouteAfterArrival();
    this.updateGoogleMaps();
    this.refreshTracking(appointment.id);
    this.refreshAppointmentState(appointment.id);
    this.isUpdatingStatus.set(false);
    this.feedback.success('Arrivee confirmee. Vous pouvez continuer la mission.');
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
    if (!this.shouldAcceptTrackingArrivalFromServer(tracking) && !this.isArrivalPinned()) {
      return tracking;
    }

    if (!this.trackingIndicatesArrival(tracking) && !this.isArrivalPinned()) {
      return tracking;
    }

    const destination = this.destinationCoordinates();
    const arrivedPoint = this.resolveArrivalPoint(destination, tracking);
    return {
      ...tracking,
      lastLatitude: arrivedPoint?.lat ?? tracking.lastLatitude,
      lastLongitude: arrivedPoint?.lng ?? tracking.lastLongitude,
      lastSpeedKmh: 0,
      lastLocationLabel:
        tracking.lastLocationLabel || 'Arrive a destination',
      presence: {
        ...tracking.presence,
        lastLatitude: arrivedPoint?.lat ?? tracking.presence.lastLatitude,
        lastLongitude: arrivedPoint?.lng ?? tracking.presence.lastLongitude,
        lastSpeedKmh: 0,
        lastLocationLabel:
          tracking.presence.lastLocationLabel || 'Arrive a destination',
      },
      route: {
        distanceRemainingMeters: 0,
        durationRemainingSeconds: 0,
        estimatedArrivalAt: new Date().toISOString(),
        encodedPolyline: '',
        coordinates: arrivedPoint
          ? [{ latitude: arrivedPoint.lat, longitude: arrivedPoint.lng }]
          : [],
        navigationSteps: [],
      },
    };
  }

  private normalizeTrackingAfterTripStart(
    tracking: AppointmentTrackingView,
  ): AppointmentTrackingView {
    if (!this.clientTravelsToProvider()) return tracking;

    const label = 'Position GPS du client';
    return {
      ...tracking,
      lastLocationLabel: label,
      presence: {
        ...tracking.presence,
        lastLocationLabel: label,
      },
    };
  }

  private hasConfirmedRouteStart(): boolean {
    return this.isConfirmedRouteTracking(this.tracking());
  }

  private isConfirmedRouteTracking(
    tracking: AppointmentTrackingView | null | undefined,
  ): boolean {
    if (!tracking) return false;

    const hasStartedAt = Boolean(tracking.startedAt);
    if (tracking.trackingStatus === 'EN_ROUTE' && hasStartedAt) {
      return true;
    }

    const hasRouteCoordinates =
      typeof tracking.lastLatitude === 'number' &&
      typeof tracking.lastLongitude === 'number' &&
      Boolean(tracking.lastPositionAt || tracking.updatedAt);

    return tracking.presence.status === 'EN_ROUTE' && hasRouteCoordinates;
  }

  private trackingIndicatesArrival(
    tracking: AppointmentTrackingView | null | undefined,
  ): boolean {
    if (!tracking) {
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

    if (this.clientTravelsToProvider()) {
      return this.trackingHasExplicitClientArrival(tracking);
    }

    if (this.isParcelDropoffNavigationActive()) {
      const hasParcelDropoffArrival = labels.some(
        (label) =>
          label.includes('arrive') &&
          label.includes('destination') &&
          label.includes('destinataire'),
      );
      return hasParcelDropoffArrival || false;
    }

    const hasDestinationArrival = labels.some(
      (label) => label.includes('arrive') && label.includes('destination'),
    );
    return hasDestinationArrival;
  }

  private trackingHasExplicitClientArrival(
    tracking: AppointmentTrackingView | null | undefined,
  ): boolean {
    if (!tracking) return false;

    return [tracking.lastLocationLabel, tracking.presence.lastLocationLabel]
      .filter((value): value is string => Boolean(value?.trim()))
      .map((value) =>
        value
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .toLocaleLowerCase('fr-FR'),
      )
      .some(
        (label) =>
          label.includes('client') &&
          label.includes('arrive') &&
          label.includes('destination'),
      );
  }

  private isArrivalPinned(): boolean {
    return this.arrivalState.isArrived(this.appointment()?.id);
  }

  private shouldAcceptTrackingArrivalFromServer(
    tracking?: AppointmentTrackingView | null,
  ): boolean {
    return (
      !this.clientTravelsToProvider() ||
      this.trackingHasExplicitClientArrival(tracking ?? this.tracking())
    );
  }

  private pinArrival(point: MapCoordinate | null): void {
    const appointment = this.appointment();
    if (!appointment) return;
    this.routeActorArrivalConfirmed.set(true);
    this.arrivalState.markArrived(appointment.id, point);
  }

  private pinnedArrivalPoint(): MapCoordinate | null {
    return this.arrivalState.pointFor(this.appointment()?.id);
  }

  private resolveArrivalPoint(
    destination: MapCoordinate | null,
    tracking?: AppointmentTrackingView | null,
  ): MapCoordinate | null {
    const pinned = this.pinnedArrivalPoint();
    if (pinned) return pinned;
    if (destination) return destination;
    if (
      typeof tracking?.lastLatitude === 'number' &&
      typeof tracking.lastLongitude === 'number'
    ) {
      return { lat: tracking.lastLatitude, lng: tracking.lastLongitude };
    }
    return null;
  }

  private isTravelerCloseEnoughToDestination(): boolean {
    const serverDistance = this.tracking()?.route?.distanceRemainingMeters;
    if (typeof serverDistance === 'number') {
      return serverDistance <= ARRIVAL_DISTANCE_THRESHOLD_METERS;
    }

    const destination = this.destinationCoordinates();
    if (destination && this.hasTrackingCoordinates()) {
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
  }

  private setTrackingSafely(tracking: NonNullable<ReturnType<typeof this.tracking>>): void {
    const normalizedTracking = this.normalizeArrivedTravelerTracking(tracking);
    this.trackingStore.setTracking(normalizedTracking);
    this.syncAppointmentStatusFromTracking(normalizedTracking);
    const appointment = this.appointment();
    if (appointment && !this.shouldRunLiveNavigation(appointment)) {
      this.stopLiveNavigation(appointment.id, false);
      return;
    }
    if (!this.hasActiveNavigationState()) {
      this.suspendNavigationPresentation();
      return;
    }
    if (
      this.shouldAcceptTrackingArrivalFromServer(normalizedTracking) &&
      this.trackingIndicatesArrival(normalizedTracking)
    ) {
      this.pinArrival(this.resolveArrivalPoint(this.destinationCoordinates(), normalizedTracking));
      this.clearNavigationRouteAfterArrival();
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
      if (serverRoute.navigationSteps?.length || this.routeCoordinates.length > 1) {
        const currentRoute = this.routeService.mapTrackingRoute(
          serverRoute,
          this.routeCoordinates,
        );
        this.routeOptions = [currentRoute];
        this.selectedRouteId.set(currentRoute.id);
      }
      this.routeStatus.set(
        this.routeCoordinates.length > 1 ? 'ready' : 'unavailable',
      );
    }
    this.updateGoogleMaps();
    this.announceNavigationInstruction();
    if (
      appointment &&
      this.isRouteActorViewer() &&
      (this.isProviderOnTheWay() || this.isParcelDropoffNavigationActive()) &&
      Date.now() >= this.locationSharingBlockedUntilMs
    ) {
      this.startProviderLocationSharing(appointment.id);
    }
  }

  private syncAppointmentStatusFromTracking(tracking: AppointmentTrackingView): void {
    this.appointment.update((appointment) => {
      if (!appointment) return appointment;

      if (
        tracking.presence.status === 'EN_PRESTATION' &&
        appointment.status !== 'EN_COURS' &&
        appointment.status !== 'TERMINEE'
      ) {
        return this.mergeAppointment(appointment, { ...appointment, status: 'EN_COURS' });
      }

      return appointment;
    });

    if (
      tracking.trackingStatus === 'TERMINEE' &&
      this.appointment()?.status === 'TERMINEE'
    ) {
      this.exitMapFullscreen();
      this.stopProviderLocationSharing();
      this.suspendNavigationPresentation();
    }
  }

  private startProviderLocationSharing(appointmentId: string): void {
    if (
      this.providerLocationSubscription ||
      !this.isRouteActorViewer() ||
      Date.now() < this.locationSharingBlockedUntilMs
    ) {
      return;
    }

    this.providerLocationSubscription = this.providerLocation
      .watch(LIVE_LOCATION_UPDATE_INTERVAL_MS)
      .subscribe({
      next: (position) => {
        if (!this.isProviderOnTheWay() && !this.isParcelDropoffNavigationActive()) {
          this.stopProviderLocationSharing();
          return;
        }

        if (
          this.hasTravelerArrivedAtDestination() ||
          (!this.clientTravelsToProvider() && this.trackingIndicatesArrival(this.tracking()))
        ) {
          this.stopProviderLocationSharing();
          return;
        }

        if (!this.geo.isCoordinateInSenegal(position.latitude, position.longitude)) {
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
                this.locationSharingBlockedUntilMs = Date.now() + 30_000;
                this.stopProviderLocationSharing();
                window.setTimeout(() => this.refreshTracking(appointmentId), 1200);
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

  private normalizeTextForMatch(value: string): string {
    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLocaleLowerCase('fr-FR');
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
    this.documentRenderer.downloadHtmlDocument(fileName, title, body);
  }

  private buildMissionInvoiceHtml(appointment: AppointmentView): string {
    return this.documentBuilder.buildMissionInvoiceHtml({
      appointment,
      subtotal: this.finalPriceAmount(),
      isParcelTransport: this.isParcelTransportAppointment(appointment),
    });
  }

  private travelModeInvoiceLabel(appointment: AppointmentView): string {
    if (appointment.travelMode === 'TRANSPORT_COLIS') return 'Transport de colis';
    if (appointment.travelMode === 'CLIENT_SE_DEPLACE') return 'Client se deplace';
    return 'Prestataire se deplace';
  }

  private buildMedicalReceiptHtml(appointment: AppointmentView): string {
    return this.documentBuilder.buildMedicalReceiptHtml({
      appointment,
      acts: this.medicalActs(),
      vaccines: this.medicalVaccines(),
      invoiceCodeLabel: this.invoiceCodeLabel(),
      finalPriceAmount: this.finalPriceAmount(),
      medicalTotalLabel: this.medicalTotalLabel(),
      generatedAtIso: new Date().toISOString(),
    });
  }

  private buildMedicalPrescriptionHtml(
    appointment: AppointmentView,
    prescription: MedicalPrescriptionPayload,
  ): string {
    return this.documentBuilder.buildMedicalPrescriptionHtml(appointment, prescription);
  }

  protected formatCurrency(value: number): string {
    return this.formatter.formatCurrency(value);
  }

  private isAppointmentInFuture(appointment: AppointmentView): boolean {
    const scheduledAt = new Date(appointment.scheduledAt);
    if (Number.isNaN(scheduledAt.getTime())) return false;

    return scheduledAt.getTime() > Date.now();
  }

  private canShowLiveTracking(appointment: AppointmentView): boolean {
    return (
      !this.isTerminalAppointmentStatus(appointment.status) ||
      LIVE_TRACKING_STATUSES.has(appointment.status)
    );
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
        this.mapRenderer.setTopView(this.effectiveMapTopView());
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
    if (this.isAnimatingRouteArrival) {
      return;
    }

    const destination = this.destinationCoordinates();
    const arrived = this.hasTravelerArrivedAtDestination();
    const arrivalPoint = arrived
      ? this.resolveArrivalPoint(destination, this.tracking())
      : null;
    const latitude = this.trackingLatitude();
    const longitude = this.trackingLongitude();
    if (
      !arrivalPoint &&
      (!this.hasTrackingCoordinates() || latitude === null || longitude === null)
    ) {
      return;
    }

    const trackedProvider: [number, number] = arrivalPoint
      ? [arrivalPoint.lat, arrivalPoint.lng]
      : [latitude as number, longitude as number];
    const displayedProvider: [number, number] =
      (this.isNonParcelWorkArrivedOnMap() || arrived) && arrivalPoint
        ? [arrivalPoint.lat, arrivalPoint.lng]
        : trackedProvider;
    this.mapRenderer.setTopView(this.effectiveMapTopView());
    if (
      destination &&
      arrived
    ) {
      this.clearNavigationRouteAfterArrival();
    }
    if (
      destination &&
      !arrived &&
      this.recalculateRouteIfOffCourse(trackedProvider, destination)
    ) {
      return;
    }
    if (
      destination &&
      (!this.isProviderWorking() || this.isParcelDropoffNavigationActive()) &&
      !this.hasTravelerArrivalConfirmation() &&
      !this.hasTravelerArrivedAtDestination() &&
      this.routeCoordinates.length < 2 &&
      this.routeStatus() !== 'calculating' &&
      Date.now() >= this.routeRequestBlockedUntilMs
    ) {
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
      destinationMarker: this.destinationMapMarker(),
      remainingLabel: this.routeRemainingBadgeLabel(),
      statusLabel: this.vehicleStatusLabel(),
      headingDegrees: this.reliableTrackingHeading(),
      routes: this.serializedMapRoutes(),
      showManeuverMarkers: this.isRouteActorViewer(),
      arrived: this.hasTravelerArrivedAtDestination(),
      travelerMarker: this.travelerMapMarker(),
    });
  }

  private travelerMapMarker(): {
    kind: 'avatar' | 'vehicle' | 'navigation';
    imageUrl: string | null;
    initials: string;
    name: string;
    roleLabel: string;
    badgeAccent?: 'blue' | 'red';
  } {
    const appointment = this.appointment();
    if (!appointment) {
      return {
        kind: 'avatar',
        imageUrl: null,
        initials: 'JK',
        name: 'Jokko',
        roleLabel: 'En route',
      };
    }

    if (this.isRouteActorViewer()) {
      return {
        kind: 'navigation',
        imageUrl: null,
        initials: 'NAV',
        name: 'Navigation',
        roleLabel: this.routeRemainingBadgeLabel(),
      };
    }

    if (appointment.travelMode === 'TRANSPORT_COLIS' && appointment.vehicleType) {
      const vehicle = PARCEL_VEHICLE_MARKERS[appointment.vehicleType];
      return {
        kind: 'vehicle',
        imageUrl: vehicle.imageUrl,
        initials: vehicle.label.slice(0, 2).toUpperCase(),
        name: vehicle.label,
        roleLabel: vehicle.label,
      };
    }

    if (this.clientTravelsToProvider()) {
      return {
        kind: 'avatar',
        imageUrl: appointment.clientAvatarUrl || null,
        initials: userInitials(appointment.clientName),
        name: appointment.clientName,
        roleLabel: this.clientFirstNameLabel(),
        badgeAccent: 'blue',
      };
    }

    return {
      kind: 'avatar',
      imageUrl: appointment.avatarUrl || null,
      initials: userInitials(appointment.doctorName),
      name: appointment.doctorName,
      roleLabel: this.providerRoleLabel(),
      badgeAccent: 'red',
    };
  }

  private singleSpecialtyLabel(label: string): string {
    return label
      .split(/(?:\s+-\s+)|[,;\n|/]+/)
      .map((item) => item.trim())
      .find(Boolean) || label.trim();
  }

  private providerExpertiseLabel(appointment: AppointmentView | null): string {
    if (!appointment) return 'professionnel';

    const candidates = [
      appointment.professionalSubCategoryName?.trim(),
      this.isServiceNameLabel(appointment.specialty, appointment) ? null : appointment.specialty?.trim(),
    ].filter((value): value is string => Boolean(value));

    const expertise = candidates.find((value) => {
      const normalized = value.toLocaleLowerCase('fr-FR');
      return normalized !== 'service non renseigne';
    });

    return this.singleSpecialtyLabel(expertise || 'professionnel');
  }

  private isServiceNameLabel(value: string | null | undefined, appointment: AppointmentView): boolean {
    const normalized = value?.trim().toLocaleLowerCase('fr-FR');
    if (!normalized) return false;

    return [appointment.serviceName, appointment.serviceCategoryName]
      .map((candidate) => candidate?.trim().toLocaleLowerCase('fr-FR'))
      .includes(normalized);
  }

  private destinationMapMarker(): {
    title: string;
    subtitle: string;
    etaLabel: string;
    accent: 'blue' | 'red';
    person?: {
      imageUrl: string | null;
      initials: string;
      name: string;
      label: string;
      badgeAccent: 'blue' | 'red';
    } | null;
  } {
    const appointment = this.appointment();
    return {
      title: appointment ? this.destinationMapMarkerTitle(appointment) : "Lieu d'arrivee",
      subtitle: this.destinationMapMarkerSubtitle(),
      etaLabel: this.destinationMapMarkerEtaLabel(),
      accent: appointment ? this.destinationMapMarkerAccent(appointment) : 'blue',
      person: appointment ? this.destinationMapMarkerPerson(appointment) : null,
    };
  }

  private destinationMapMarkerPerson(appointment: AppointmentView): {
    imageUrl: string | null;
    initials: string;
    name: string;
    label: string;
    badgeAccent: 'blue' | 'red';
  } | null {
    if (this.isParcelTransportAppointment(appointment)) {
      return null;
    }

    if (appointment.travelMode === 'CLIENT_SE_DEPLACE') {
      return {
        imageUrl: appointment.avatarUrl || null,
        initials: userInitials(appointment.doctorName),
        name: appointment.doctorName,
        label: this.providerRoleLabel(),
        badgeAccent: 'red',
      };
    }

    if (appointment.travelMode === 'PRESTATAIRE_SE_DEPLACE') {
      return {
        imageUrl: appointment.clientAvatarUrl || null,
        initials: userInitials(appointment.clientName),
        name: appointment.clientName,
        label: this.isClientViewer() ? 'Moi' : this.clientFirstNameLabel(),
        badgeAccent: 'blue',
      };
    }

    return null;
  }

  private destinationMapMarkerTitle(appointment: AppointmentView): string {
    if (this.isParcelTransportAppointment(appointment)) {
      return this.isParcelPickupValidated() || this.isParcelDropoffNavigationActive()
        ? 'Destination de depot de colis'
        : 'Destination de retrait de colis';
    }

    return appointment.travelMode === 'CLIENT_SE_DEPLACE'
      ? "Adresse d'intervention"
      : "Lieu d'intervention";
  }

  private destinationMapMarkerSubtitle(): string {
    const distance = this.routeDistanceKm();
    return distance !== null && distance > 0 ? this.formatter.formatDistance(distance) : '';
  }

  private destinationMapMarkerEtaLabel(): string {
    return this.hasTravelerArrivedAtDestination() ? '0 min' : this.routeEtaLabel();
  }

  private destinationMapMarkerAccent(appointment: AppointmentView): 'blue' | 'red' {
    if (this.isParcelTransportAppointment(appointment)) return 'blue';
    return appointment.travelMode === 'PRESTATAIRE_SE_DEPLACE' ? 'red' : 'blue';
  }

  private isNonParcelWorkArrivedOnMap(): boolean {
    return (
      this.isProviderWorking() &&
      !this.isParcelDropoffNavigationActive() &&
      !this.isParcelDeliveryFlow()
    );
  }

  private serializedMapRoutes(): Array<{
    id: string;
    selected: boolean;
    coordinates: MapCoordinate[];
    navigationSteps: Array<{
      id: string;
      instruction: string;
      maneuver: string | null;
      distanceMeters: number | null;
      start: MapCoordinate | null;
      end: MapCoordinate | null;
    }>;
  }> {
    return this.routeService.serializeMapRoutes(this.routeOptions, this.selectedRouteId());
  }

  private recalculateRouteIfOffCourse(
    trackedProvider: [number, number],
    destination: MapCoordinate,
  ): boolean {
    if (
      this.routeCoordinates.length < 2 ||
      this.routeStatus() === 'calculating' ||
      Date.now() < this.routeRequestBlockedUntilMs ||
      Date.now() < this.routeDeviationRecalculationBlockedUntilMs
    ) {
      return false;
    }

    const currentPosition = { lat: trackedProvider[0], lng: trackedProvider[1] };
    if (
      this.geo.distanceMetersBetweenPoints(currentPosition, destination) <=
      ARRIVAL_DISTANCE_THRESHOLD_METERS
    ) {
      return false;
    }

    const deviationMeters = this.distanceFromCurrentRouteMeters(currentPosition);
    if (deviationMeters <= ROUTE_DEVIATION_THRESHOLD_METERS) {
      return false;
    }

    this.routeDeviationRecalculationBlockedUntilMs =
      Date.now() + ROUTE_DEVIATION_RECALCULATION_COOLDOWN_MS;
    this.routeCoordinatesKey = '';
    this.loadRouteCoordinates(trackedProvider, [destination.lat, destination.lng]);
    return true;
  }

  private distanceFromCurrentRouteMeters(position: MapCoordinate): number {
    if (this.routeCoordinates.length < 2) {
      return Number.POSITIVE_INFINITY;
    }

    let nearestDistance = Number.POSITIVE_INFINITY;
    for (let index = 1; index < this.routeCoordinates.length; index += 1) {
      const previous = this.routeCoordinates[index - 1];
      const current = this.routeCoordinates[index];
      const distance = this.distanceToRouteSegmentMeters(position, {
        lat: previous[0],
        lng: previous[1],
      }, {
        lat: current[0],
        lng: current[1],
      });
      if (distance < nearestDistance) {
        nearestDistance = distance;
      }
    }

    return nearestDistance;
  }

  private distanceToRouteSegmentMeters(
    point: MapCoordinate,
    start: MapCoordinate,
    end: MapCoordinate,
  ): number {
    const metersPerLatitudeDegree = 110_540;
    const metersPerLongitudeDegree =
      111_320 * Math.cos((point.lat * Math.PI) / 180);
    const startX = (start.lng - point.lng) * metersPerLongitudeDegree;
    const startY = (start.lat - point.lat) * metersPerLatitudeDegree;
    const endX = (end.lng - point.lng) * metersPerLongitudeDegree;
    const endY = (end.lat - point.lat) * metersPerLatitudeDegree;
    const segmentX = endX - startX;
    const segmentY = endY - startY;
    const segmentLengthSquared = segmentX * segmentX + segmentY * segmentY;

    if (segmentLengthSquared <= 0) {
      return this.geo.distanceMetersBetweenPoints(point, start);
    }

    const projection = Math.max(
      0,
      Math.min(1, -(startX * segmentX + startY * segmentY) / segmentLengthSquared),
    );
    const closestX = startX + projection * segmentX;
    const closestY = startY + projection * segmentY;
    return Math.sqrt(closestX * closestX + closestY * closestY);
  }

  protected runProviderPrimaryAction(appointment: AppointmentView): void {
    if (this.isAppointmentCompleted()) {
      this.downloadInvoice(appointment);
      return;
    }
    if (this.isParcelTransportAppointment(appointment)) {
      this.runParcelPrimaryAction(appointment);
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

  protected runParcelPrimaryAction(appointment: AppointmentView): void {
    if (!this.canUseParcelActionButton()) return;

    if (!this.isProviderOnTheWay() && !this.isProviderWorking()) {
      void this.markOnTheWay(appointment);
      return;
    }

    if (this.isParcelAwaitingPickupScan()) {
      this.openQrCodePage(appointment, 'expediteur', true);
      return;
    }

    if (this.isParcelPickupValidated() && !this.isProviderWorking()) {
      this.routeActorArrivalConfirmed.set(false);
      this.arrivalState.clear(appointment.id);
      this.isUpdatingStatus.set(true);
      this.submitStartWork(appointment, false);
      return;
    }

    if (this.isParcelAwaitingDropoffScan()) {
      this.openQrCodePage(appointment, 'destinataire', true);
      return;
    }

    if (this.isParcelDropoffNavigationActive() || this.isProviderOnTheWay()) {
      this.markTravelerArrived(appointment);
    }
  }

  private vehicleStatusLabel(): string {
    const appointment = this.appointment();
    if (!appointment) return 'Trajet en cours';
    if (this.isParcelTransportAppointment(appointment)) {
      if (this.hasTravelerArrivedAtDestination()) {
        return this.activeTrackingScenario().vehicleArrivedLabel(this.trackingScenarioContext());
      }
      return this.isParcelPickupValidated()
        ? `Le livreur est en route vers le destinataire · ${this.routeEtaLabel()}`
        : `Le livreur est en route vers l'expediteur · ${this.routeEtaLabel()}`;
    }
    if (this.hasTravelerArrivedAtDestination()) {
      return this.activeTrackingScenario().vehicleArrivedLabel(this.trackingScenarioContext());
    }
    if (!this.isProviderWorking() || this.isParcelDropoffNavigationActive()) {
      return this.activeVehicleRouteLabel(true);
    }
    return this.isProviderWorking() && !this.isParcelDropoffNavigationActive()
      ? `Arrive a destination de ${this.arrivalDestinationLabel(appointment)}`
      : `En route vers ${this.routeVehiclePersonLabel()} · ${this.routeEtaLabel()}`;
  }

  private activeVehicleRouteLabel(withEta: boolean): string {
    const appointment = this.appointment();
    if (!appointment) return 'Trajet en cours';

    let label: string;
    if (appointment.travelMode === 'PRESTATAIRE_SE_DEPLACE') {
      label = `En route vers ${this.clientRouteName(appointment)}`;
    } else if (appointment.travelMode === 'CLIENT_SE_DEPLACE') {
      label = `${this.clientRouteName(appointment)} en route vers le lieu du RDV`;
    } else {
      label = `En route vers ${this.routeVehiclePersonLabel()}`;
    }

    return withEta ? `${label} - ${this.routeEtaLabel()}` : label;
  }

  private clientRouteName(appointment: AppointmentView): string {
    return appointment.clientName?.trim() || 'Le client';
  }

  private routeVehiclePersonLabel(): string {
    const appointment = this.appointment();
    if (!appointment) {
      return this.isProviderViewer() ? 'le client' : 'le prestataire';
    }

    const personName = this.isProviderViewer()
      ? appointment.clientName?.trim()
      : appointment.doctorName?.trim();

    if (personName) return personName;
    return this.isProviderViewer() ? 'le client' : 'le prestataire';
  }

  private parcelArrivedVehicleStatusLabel(): string {
    return this.activeTrackingScenario().vehicleArrivedLabel(this.trackingScenarioContext());
  }

  private trackedTravelerPositionLabel(): string {
    return this.clientTravelsToProvider()
      ? 'Position GPS du client'
      : 'Position GPS du prestataire';
  }

  private reliableTrackingHeading(): number | null {
    if (this.isProviderWorking() && !this.isParcelDropoffNavigationActive()) {
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

  private distanceMetersBetweenCurrentPosition(
    destination: MapCoordinate,
  ): number {
    const latitude = this.trackingLatitude();
    const longitude = this.trackingLongitude();
    if (latitude === null || longitude === null) {
      return Number.POSITIVE_INFINITY;
    }

    return this.geo.distanceMetersBetweenPoints({ lat: latitude, lng: longitude }, destination);
  }

  private announceNavigationInstruction(force = false): void {
    if (
      !this.hasActiveNavigationState() ||
      !this.isNavigationVoiceEnabled() ||
      typeof window === 'undefined'
    ) {
      return;
    }

    this.navigationService.speakInstruction(
      this.navigationInstruction(),
      this.navigationDistanceLabel(),
      force,
    );
  }

  private hasActiveNavigationState(): boolean {
    return this.hasActiveTrackingNavigation();
  }

  private destroyRouteMap(): void {
    this.mapRenderer.destroyRouteMap();
    this.trackingMapElement = undefined;
  }

  private loadRouteCoordinates(provider: [number, number], destinationPoint: [number, number]): void {
    const key = `${this.geo.routePointKey(provider)}|${this.geo.routePointKey(destinationPoint)}`;
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
          const routes = this.routeService.mapGoogleRoutes(googleRoutes);
        const route = routes[0];
        if (
          !route ||
          !this.geo.isCoordinateInSenegal(provider[0], provider[1]) ||
          !this.geo.isCoordinateInSenegal(destinationPoint[0], destinationPoint[1])
        ) {
          this.routeCoordinates = [];
          this.routeOptions = [];
          this.routeAlternatives.set([]);
          this.mapRenderer.resetRoute();
          this.routeStatus.set('unavailable');
          return;
        }

        this.routeOptions = [{ ...route, id: 'route-0' }];
        this.selectedRouteId.set('route-0');
        this.applySelectedRoute(this.routeOptions[0]);
        if (this.routeCoordinates.length < 2) {
          this.mapRenderer.resetRoute();
          this.routeStatus.set('unavailable');
          return;
        }

        this.routeAlternatives.set([]);
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
        this.routeRequestBlockedUntilMs = Date.now() + 20_000;
        this.routeStatus.set('unavailable');
        },
      });
  }

  private applySelectedRoute(route: AppointmentRouteOption | undefined): void {
    if (!route) return;

    this.routeCoordinates = route.coordinates;
    this.routeDistanceKm.set(route.distanceKm);
    this.routeDurationMinutes.set(route.durationMinutes);
  }

  private refreshRouteAlternatives(): void {
    this.routeAlternatives.set([]);
  }

  private clearNavigationRouteAfterArrival(): void {
    this.routeDistanceKm.set(0);
    this.routeDurationMinutes.set(0);
    this.routeCoordinates = [];
    this.routeOptions = [];
    this.routeAlternatives.set([]);
    this.routeCoordinatesKey = '';
    this.routeStatus.set('ready');
  }

  private resolveDestinationCoordinates(addressLabel: string): void {
    const preferredCoordinates = this.currentRouteDestinationCoordinates();
    if (preferredCoordinates && typeof window !== 'undefined') {
      const coordinateKey = `coords:${preferredCoordinates.lat.toFixed(7)},${preferredCoordinates.lng.toFixed(7)}`;
      if (coordinateKey === this.lastResolvedDestinationAddress && this.destinationCoordinates()) {
        this.updateGoogleMaps();
        return;
      }

      this.clearResolvedDestination();
      this.lastResolvedDestinationAddress = coordinateKey;
      this.destinationCoordinates.set(preferredCoordinates);
      this.destinationStatus.set('ready');
      this.updateGoogleMaps();
      return;
    }

    const query = this.geo.normalizeAddressQuery(addressLabel);
    if (!query || typeof window === 'undefined') {
      if (!query && this.lastResolvedDestinationAddress) {
        this.clearResolvedDestination();
      }
      return;
    }
    if (query === this.lastResolvedDestinationAddress && this.destinationCoordinates()) {
      this.updateGoogleMaps();
      return;
    }

    this.clearResolvedDestination();
    this.lastResolvedDestinationAddress = query;
    const explicitCoordinates = this.geo.extractCoordinatesFromAddress(query);
    if (!explicitCoordinates && this.geo.hasCoordinateLikeAddress(query)) {
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
        if (result && this.geo.isCoordinateInSenegal(result.latitude, result.longitude)) {
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

  private clearResolvedDestination(): void {
    this.destinationCoordinates.set(null);
    this.destinationStatus.set('idle');
    this.routeStatus.set('idle');
    this.routeCoordinates = [];
    this.routeOptions = [];
    this.routeAlternatives.set([]);
    this.routeCoordinatesKey = '';
    this.routeRequestBlockedUntilMs = 0;
    this.mapRenderer.resetRoute();
    this.routeDistanceKm.set(null);
    this.routeDurationMinutes.set(null);
  }

  private mergeAppointment(current: AppointmentView, updated: AppointmentView): AppointmentView {
    const merged = {
      ...current,
      ...updated,
      status: this.mergeAppointmentStatus(current.status, updated.status),
      doctorName: current.doctorName,
      specialty: current.specialty,
      avatarUrl: current.avatarUrl,
      professionalPhone: current.professionalPhone,
      professionalAddressLabel: current.professionalAddressLabel,
      professionalRating: current.professionalRating,
      professionalReviews: current.professionalReviews,
      clientName: current.clientName,
      clientPhone: current.clientPhone,
      clientAvatarUrl: current.clientAvatarUrl,
      serviceName: current.serviceName,
      serviceDescription: current.serviceDescription,
      serviceCategoryName: current.serviceCategoryName,
      professionalSubCategoryName: current.professionalSubCategoryName,
    };
    this.hydrateMedicalPrescriptionFromAppointment(merged);
    return merged;
  }

  private mergeAppointmentStatus(
    current: AppointmentView['status'],
    updated: AppointmentView['status'],
  ): AppointmentView['status'] {
    if (
      current === 'EN_COURS' &&
      (updated === 'PAYEE_SEQUESTRE' || updated === 'CONFIRMEE')
    ) {
      return current;
    }

    if (current === 'TERMINEE' && updated !== 'TERMINEE') {
      return current;
    }

    return updated;
  }

  private currentMedicalPrescriptionPayload(): MedicalPrescriptionPayload {
    return {
      acts: this.medicalPrescriptionService.normalizeItems([
        ...this.medicalActs(),
        this.currentMedicalAct(),
      ]),
      vaccines: this.medicalPrescriptionService.normalizeItems([
        ...this.medicalVaccines(),
        this.currentMedicalVaccine(),
      ]),
      treatments: this.medicalPrescriptionService.normalizeItems([
        ...this.medicalTreatments(),
        this.currentMedicalTreatment(),
      ]),
    };
  }

  private medicalPrescriptionForDocument(
    appointment: AppointmentView,
  ): MedicalPrescriptionPayload {
    const persisted = this.medicalPrescriptionService.hasContent(appointment.medicalPrescription)
      ? appointment.medicalPrescription
      : this.medicalPrescriptionService.extractFromNotes(appointment.notes);
    if (persisted && this.medicalPrescriptionService.hasContent(persisted)) {
      return persisted;
    }

    return this.currentMedicalPrescriptionPayload();
  }

  private persistMedicalPrescriptionDraft(): void {
    const appointment = this.appointment();
    if (!appointment || !this.isProviderViewer() || !this.isMedicalAppointment()) return;

    const prescription = this.currentMedicalPrescriptionPayload();
    if (!this.medicalPrescriptionService.hasContent(prescription)) return;

    this.appointmentsService
      .saveMedicalPrescription(appointment.id, prescription)
      .pipe(catchError(() => of(null)))
      .subscribe((updated) => {
        if (!updated) return;
        this.appointment.update((current) =>
          current ? this.mergeMedicalPrescriptionUpdate(current, updated) : updated,
        );
      });
  }

  private mergeMedicalPrescriptionUpdate(
    current: AppointmentView,
    updated: AppointmentView,
  ): AppointmentView {
    const merged = {
      ...current,
      notes: updated.notes,
      medicalPrescription: updated.medicalPrescription,
    };
    this.hydrateMedicalPrescriptionFromAppointment(merged);
    return merged;
  }

  private hydrateMedicalPrescriptionFromAppointment(appointment: AppointmentView): void {
    const prescription = this.medicalPrescriptionService.hasContent(appointment.medicalPrescription)
      ? appointment.medicalPrescription
      : this.medicalPrescriptionService.extractFromNotes(appointment.notes);
    if (!prescription) return;

    this.medicalActs.set(prescription.acts);
    this.medicalVaccines.set(prescription.vaccines);
    this.medicalTreatments.set(prescription.treatments);
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

          if (!this.geo.isCoordinateInSenegal(position.coords.latitude, position.coords.longitude)) {
            reject(new Error('Geolocation outside Senegal'));
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

}

