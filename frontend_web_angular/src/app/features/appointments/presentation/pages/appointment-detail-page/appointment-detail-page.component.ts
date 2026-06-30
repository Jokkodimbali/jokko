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
import { Subscription, catchError, merge, of, switchMap, timer } from 'rxjs';
import { AuthSessionService } from '../../../../../core/auth/auth-session.service';
import { AppFeedbackService } from '../../../../../core/feedback/app-feedback.service';
import { BackNavigationService } from '../../../../../core/navigation/back-navigation.service';
import { userInitials } from '../../../../../shared/utils/user-initials';
import { getHttpErrorMessage } from '../../../../../core/http/api-response.utils';
import { MessagesService } from '../../../../messages/data-access/messages.service';
import { AppointmentsService } from '../../../data-access/appointments.service';
import { AppointmentTrackingView, AppointmentView } from '../../../domain/appointments.models';
import { AppointmentDetailLoadingComponent } from '../../components/appointment-detail-loading/appointment-detail-loading.component';
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
const SENEGAL_GEO_BOUNDS = {
  minLat: 12,
  maxLat: 17.2,
  minLng: -18.7,
  maxLng: -11,
} as const;

type AppointmentDetailUiState =
  | 'loading'
  | 'error'
  | 'completed'
  | 'closed'
  | 'working'
  | 'route'
  | 'upcoming';

@Component({
  selector: 'app-appointment-detail-page',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    LucideAngularModule,
    AppointmentDetailLoadingComponent,
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
  private providerLocationSubscription?: Subscription;
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
  protected readonly isNavigationVoiceEnabled = signal(true);
  protected readonly mapHeadingDegrees = signal(0);
  protected readonly selectedRouteId = signal('route-0');
  protected readonly routeAlternatives = signal<RouteAlternativeView[]>([]);
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
    const role = this.currentUser()?.role;
    return role === 'PRESTATAIRE' || role === 'MEDECIN';
  });
  protected readonly canManageProviderStatus = computed(() => {
    const appointment = this.appointment();
    return (
      (this.currentUser()?.role === 'PRESTATAIRE' || this.currentUser()?.role === 'MEDECIN') &&
      !!appointment &&
      appointment.status !== 'TERMINEE' &&
      appointment.status !== 'ANNULEE' &&
      appointment.status !== 'NO_SHOW' &&
      appointment.status !== 'LITIGE'
    );
  });
  protected readonly canCancelAppointment = computed(() => {
    const status = this.appointment()?.status;
    return (
      !!status &&
      status !== 'TERMINEE' &&
      status !== 'ANNULEE' &&
      status !== 'NO_SHOW' &&
      status !== 'LITIGE'
    );
  });
  protected readonly minRescheduleDateTime = computed(() =>
    this.toDateTimeLocalValue(new Date(Date.now() + 15 * 60 * 1000)),
  );
  protected readonly isAppointmentCompleted = computed(
    () => this.appointment()?.status === 'TERMINEE',
  );
  protected readonly isAppointmentClosed = computed(() => {
    const status = this.appointment()?.status;
    return (
      status === 'ANNULEE' ||
      status === 'NO_SHOW' ||
      status === 'LITIGE'
    );
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
      !this.isProviderOnTheWay() &&
      !this.isProviderWorking() &&
      this.canStartRouteToday()
    );
  });
  protected readonly canProviderStartWork = computed(() => {
    const appointment = this.appointment();
    return (
      !!appointment &&
      this.canManageProviderStatus() &&
      this.canStartRouteToday() &&
      appointment.status === 'PAYEE_SEQUESTRE' &&
      this.isProviderOnTheWay()
    );
  });
  protected readonly canProviderCompleteWork = computed(() => {
    const appointment = this.appointment();
    return (
      !!appointment &&
      this.canManageProviderStatus() &&
      !this.isAppointmentInFuture(appointment) &&
      (appointment.status === 'PAYEE_SEQUESTRE' || appointment.status === 'EN_COURS')
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
    return status === 'EN_ATTENTE' || status === 'CONFIRMEE';
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
    if (status === 'EN_ATTENTE') return 'Paiement en attente';
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
    if (status === 'EN_ATTENTE' || status === 'CONFIRMEE') {
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
    () => !this.hasTrackingCoordinates() || this.routeStatus() === 'unavailable',
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
      this.isProviderOnTheWay() ||
      this.isProviderWorking() ||
      this.isAppointmentCompleted(),
  );
  protected readonly detailUiState = computed<AppointmentDetailUiState>(() => {
    if (this.isLoading()) return 'loading';
    if (this.errorMessage()) return 'error';
    if (this.isAppointmentCompleted()) return 'completed';
    if (this.isAppointmentClosed()) return 'closed';
    if (this.isProviderWorking()) return 'working';
    if (this.isProviderOnTheWay()) return 'route';
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
    this.trackingStore.reset();
  }

  protected goBack(): void {
    this.backNavigation.back(this.safeReturnUrl(), '/appointments');
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

  protected shareProviderLocation(appointment: AppointmentView): void {
    if (this.isUpdatingStatus() || !this.isProviderViewer()) return;

    this.isUpdatingStatus.set(true);
    this.feedback.info(
      "Autorisez la localisation du navigateur pour partager automatiquement votre position reelle.",
    );
    this.resolveCurrentLocation('Position GPS du prestataire')
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

  protected rotateMap(): void {
    const nextHeading = (this.mapHeadingDegrees() + 45) % 360;
    this.mapHeadingDegrees.set(nextHeading);
    this.mapRenderer.setHeading(nextHeading);
  }

  protected resetMapRotation(): void {
    this.mapHeadingDegrees.set(0);
    this.mapRenderer.setHeading(0);
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
    if (!this.canProviderMarkOnTheWay()) {
      if (!silent) {
        this.feedback.info(
          "Le suivi en route s'active uniquement par le prestataire le jour de la prestation, apres paiement.",
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

    const location = await this.resolveCurrentLocation('Position GPS du prestataire').catch(
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
          this.feedback.success('Statut mis a jour : prestataire en route.');
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
          "La prestation peut commencer uniquement le jour du rendez-vous, apres l'activation du trajet.",
        );
      }
      return;
    }

    this.isUpdatingStatus.set(true);
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
          this.feedback.error('Impossible de demarrer. La reservation doit etre payee.');
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
          "Vous pourrez terminer la prestation apres l'heure du rendez-vous, si elle est payee ou deja en cours.",
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
    const fallbackPolling$ = timer(0, 30000).pipe(
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
    this.trackingSubscription = undefined;
    this.missionSubscription = undefined;
    this.connectionSubscription = undefined;
    this.stopProviderLocationSharing();
    if (appointmentId) {
      this.trackingRealtime.stopWatching(appointmentId);
    }
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
    if (resetTracking) {
      this.trackingStore.reset();
    }
  }

  private suspendNavigationPresentation(): void {
    this.stopProviderLocationSharing();
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
    return (
      status === 'TERMINEE' ||
      status === 'ANNULEE' ||
      status === 'NO_SHOW' ||
      status === 'LITIGE'
    );
  }

  private shouldRunLiveNavigation(appointment: AppointmentView): boolean {
    return (
      (appointment.status === 'PAYEE_SEQUESTRE' ||
        appointment.status === 'EN_COURS') &&
      this.canShowLiveTracking(appointment)
    );
  }

  private refreshAppointmentState(appointmentId: string): void {
    this.appointmentsService
      .getAppointmentById(appointmentId)
      .pipe(catchError(() => of(null)))
      .subscribe((appointment) => {
        if (appointment) {
          this.appointment.set(appointment);
          this.synchronizeLiveNavigation(appointment);
        }
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

  private setTrackingSafely(tracking: NonNullable<ReturnType<typeof this.tracking>>): void {
    window.setTimeout(() => {
      this.trackingStore.setTracking(tracking);
      const appointment = this.appointment();
      if (appointment && !this.shouldRunLiveNavigation(appointment)) {
        this.stopLiveNavigation(appointment.id, false);
        return;
      }
      if (!this.hasActiveNavigationState()) {
        this.suspendNavigationPresentation();
        return;
      }
      const serverRoute = tracking.route;
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
      if (appointment && this.isProviderViewer() && this.isProviderOnTheWay()) {
        this.startProviderLocationSharing(appointment.id);
      }
    }, 0);
  }

  private startProviderLocationSharing(appointmentId: string): void {
    if (
      this.providerLocationSubscription ||
      !this.isProviderViewer()
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
            locationLabel: 'Position GPS du prestataire',
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
      this.isProviderWorking() && destination
        ? [destination.lat, destination.lng]
        : trackedProvider;
    if (destination && !this.isProviderWorking()) {
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
      routes: this.routeOptions
        .filter((route) => route.coordinates.length > 1)
        .map((route) => ({
          id: route.id,
          selected: route.id === this.selectedRouteId(),
          coordinates: route.coordinates.map(([lat, lng]) => ({ lat, lng })),
        })),
    });
  }

  private vehicleStatusLabel(): string {
    const appointment = this.appointment();
    if (!appointment) return 'Prestataire en route';
    return this.isProviderWorking()
      ? `Arrive a destination de ${this.arrivalDestinationLabel(appointment)}`
      : `En route vers ${this.arrivalDestinationLabel(appointment)} · ${this.routeEtaLabel()}`;
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
    return (
      this.appointment()?.status === 'EN_COURS' ||
      this.tracking()?.trackingStatus === 'EN_ROUTE'
    );
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

  private formatCurrency(value: number): string {
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
