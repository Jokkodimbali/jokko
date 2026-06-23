import { CommonModule, Location } from '@angular/common';
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
import { Subscription, catchError, of, switchMap, timer } from 'rxjs';
import { AuthSessionService } from '../../../../../core/auth/auth-session.service';
import { AppFeedbackService } from '../../../../../core/feedback/app-feedback.service';
import { getHttpErrorMessage } from '../../../../../core/http/api-response.utils';
import { MessagesService } from '../../../../messages/data-access/messages.service';
import { AppointmentsService } from '../../../data-access/appointments.service';
import { AppointmentTrackingView, AppointmentView } from '../../../domain/appointments.models';

type LeafletLatLng = { lat: number; lng: number };
type LeafletNamespace = NonNullable<Window['L']> & {
  polyline?: (
    latlngs: Array<[number, number]>,
    options?: Record<string, unknown>,
  ) => LeafletLayerInstance;
};
type LeafletMapInstance = ReturnType<NonNullable<Window['L']>['map']> & {
  fitBounds?: (bounds: Array<[number, number]>, options?: Record<string, unknown>) => void;
  on?: (eventName: string, handler: () => void) => void;
  removeLayer?: (layer: LeafletLayerInstance) => void;
};
type LeafletLayerInstance = {
  addTo(map: LeafletMapInstance): LeafletLayerInstance;
  remove?: () => void;
  addEventListener?: (eventName: string, handler: () => void) => void;
  setIcon?: (icon: unknown) => void;
  setLatLng?: (latlng: [number, number]) => void;
  setLatLngs?: (latlngs: Array<[number, number]>) => void;
};
type LeafletTileLayerInstance = LeafletLayerInstance;
type GeocodeCandidate = {
  lat?: string;
  lon?: string;
  display_name?: string;
  importance?: number;
  address?: {
    country_code?: string;
  };
};
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
  ],
  templateUrl: './appointment-detail-page.component.html',
  styleUrls: [
    './appointment-detail-page.component.scss',
    './appointment-detail-upcoming.component.scss',
    './appointment-detail-tracking.component.scss',
    './appointment-detail-responsive.component.scss',
    './appointment-detail-map.component.scss',
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
    window.setTimeout(() => void this.initializeLeafletMaps(), 0);
  }

  @ViewChild('workTrackingMap')
  set workTrackingMapRef(value: ElementRef<HTMLElement> | undefined) {
    if (!value) {
      this.destroyWorkMap();
      return;
    }

    this.workTrackingMapElement = value?.nativeElement;
    window.setTimeout(() => void this.initializeLeafletMaps(), 0);
  }

  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly location = inject(Location);
  private readonly appointmentsService = inject(AppointmentsService);
  private readonly messagesService = inject(MessagesService);
  private readonly feedback = inject(AppFeedbackService);
  private readonly authSession = inject(AuthSessionService);
  private trackingSubscription?: Subscription;
  private leafletLoadPromise?: Promise<LeafletNamespace>;
  private routeMap?: LeafletMapInstance;
  private workMap?: LeafletMapInstance;
  private routeStreetLayer?: LeafletTileLayerInstance;
  private routeSatelliteLayer?: LeafletTileLayerInstance;
  private routeProviderMarker?: LeafletLayerInstance;
  private routeDestinationMarker?: LeafletLayerInstance;
  private routePolyline?: LeafletLayerInstance;
  private routeAlternativePolylines: LeafletLayerInstance[] = [];
  private workProviderMarker?: LeafletLayerInstance;
  private routeMapUserInteracted = false;
  private routeAutoFitKey = '';
  private providerLocationWatchId: number | null = null;
  private lastProviderLocationPushAt = 0;
  private routeCoordinates: Array<[number, number]> = [];
  private routeOptions: RouteOption[] = [];
  private routeCoordinatesKey = '';
  private trackingMapElement?: HTMLElement;
  private workTrackingMapElement?: HTMLElement;

  protected readonly currentUser = this.authSession.currentUser;
  protected readonly appointment = signal<AppointmentView | null>(null);
  protected readonly tracking = signal<AppointmentTrackingView | null>(null);
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
  protected readonly destinationCoordinates = signal<LeafletLatLng | null>(null);
  protected readonly routeDistanceKm = signal<number | null>(null);
  protected readonly routeDurationMinutes = signal<number | null>(null);
  protected readonly routeStatus = signal<'idle' | 'calculating' | 'ready' | 'unavailable'>('idle');
  protected readonly isSatelliteMapEnabled = signal(false);
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
      appointment.status !== 'NO_SHOW'
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
    if (this.isProviderWorking()) return 'Prestation en cour';
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
  protected readonly remainingDistanceLabel = computed(() => {
    if (!this.isProviderOnTheWay()) return 'Suivi inactif';
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
    if (this.routeStatus() === 'calculating') return "Calcul de l'itineraire...";
    if (this.routeStatus() === 'ready') {
      const minutes = this.estimatedArrivalMinutes();
      return minutes > 0 ? `Itineraire reel - ${minutes} min` : 'Itineraire reel pret';
    }
    return 'Carte en temps reel';
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
    void this.initializeLeafletMaps();
  }

  ngOnDestroy(): void {
    this.trackingSubscription?.unsubscribe();
    this.destroyRouteMap();
    this.destroyWorkMap();
    this.stopProviderLocationSharing();
  }

  protected goBack(): void {
    const returnUrl = this.safeReturnUrl();
    if (returnUrl) {
      this.router.navigateByUrl(returnUrl);
      return;
    }

    this.location.back();
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
    return (
      name
        .split(' ')
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase())
        .join('') || fallback
    );
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
      return `https://www.openstreetmap.org/directions?engine=fossgis_osrm_car&route=${latitude}%2C${longitude}%3B${destination}`;
    }

    return `https://www.openstreetmap.org/search?query=${destination}`;
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
    this.router.navigate(['/appointments', appointment.id, 'qr', type], {
      queryParams: { returnUrl: this.router.url },
    });
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
      .catch(() => {
        this.isUpdatingStatus.set(false);
        this.feedback.error(
          "Impossible de recuperer votre position exacte. Autorisez la localisation GPS.",
        );
      });
  }

  protected toggleSatelliteMap(): void {
    this.isSatelliteMapEnabled.update((enabled) => !enabled);
    this.updateRouteBaseLayer();
  }

  protected selectRouteAlternative(routeId: string): void {
    const route = this.routeOptions.find((option) => option.id === routeId);
    if (!route) return;

    this.selectedRouteId.set(routeId);
    this.applySelectedRoute(route);
    const leaflet = window.L as LeafletNamespace | undefined;
    const destination = this.destinationCoordinates();
    const latitude = this.trackingLatitude();
    const longitude = this.trackingLongitude();
    if (leaflet && destination && typeof latitude === 'number' && typeof longitude === 'number') {
      this.renderRoutePolyline(leaflet);
    }
    this.refreshRouteAlternatives();
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
    const location = await this.resolveCurrentLocation('Position GPS du prestataire').catch(() => null);
    if (!location) {
      this.isUpdatingStatus.set(false);
      if (!silent) {
        this.feedback.error(
          "Impossible d'activer le trajet : autorisez la position GPS reelle du prestataire.",
        );
      }
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
        this.refreshTracking(appointment.id);
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
        this.refreshTracking(appointment.id);
        this.stopProviderLocationSharing();
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
        this.startTrackingPolling(appointment.id);
        this.resolveDestinationCoordinates(appointment.addressLabel);
        window.setTimeout(() => void this.initializeLeafletMaps(), 0);
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
    this.trackingSubscription = timer(0, 10000)
      .pipe(
        switchMap(() =>
          this.appointmentsService
            .getAppointmentTracking(appointmentId)
            .pipe(catchError(() => of(null))),
        ),
      )
      .subscribe((tracking) => {
        if (tracking) {
          this.setTrackingSafely(tracking);
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
      this.tracking.set(tracking);
      this.updateLeafletMaps();
      const appointment = this.appointment();
      if (appointment && this.isProviderViewer() && this.isProviderOnTheWay()) {
        this.startProviderLocationSharing(appointment.id);
      }
    }, 0);
  }

  private startProviderLocationSharing(appointmentId: string): void {
    if (
      this.providerLocationWatchId !== null ||
      !this.isProviderViewer() ||
      typeof navigator === 'undefined' ||
      !navigator.geolocation
    ) {
      return;
    }

    this.providerLocationWatchId = navigator.geolocation.watchPosition(
      (position) => {
        if (!this.isProviderOnTheWay()) {
          this.stopProviderLocationSharing();
          return;
        }

        if (!this.isCoordinateInSenegal(position.coords.latitude, position.coords.longitude)) {
          return;
        }

        const now = Date.now();
        if (now - this.lastProviderLocationPushAt < 8000) return;
        this.lastProviderLocationPushAt = now;

        this.appointmentsService
          .updateProviderTrackingLocation(appointmentId, {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracyMeters: position.coords.accuracy,
            headingDegrees:
              typeof position.coords.heading === 'number' ? position.coords.heading : null,
            speedKmh:
              typeof position.coords.speed === 'number' ? position.coords.speed * 3.6 : null,
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
      () => undefined,
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 7000 },
    );
  }

  private stopProviderLocationSharing(): void {
    if (
      this.providerLocationWatchId === null ||
      typeof navigator === 'undefined' ||
      !navigator.geolocation
    ) {
      this.providerLocationWatchId = null;
      return;
    }

    navigator.geolocation.clearWatch(this.providerLocationWatchId);
    this.providerLocationWatchId = null;
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

  private async initializeLeafletMaps(): Promise<void> {
    if (typeof window === 'undefined') return;
    const leaflet = await this.loadLeaflet();
    const defaultCenter: [number, number] = [14.7167, -17.4677];

    if (this.trackingMapElement && !this.routeMap) {
      const map = leaflet.map(this.trackingMapElement, {
        attributionControl: false,
        zoomControl: true,
      });
      this.routeMap = map;
      this.routeStreetLayer = leaflet
        .tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
          attribution: '&copy; OpenStreetMap',
        });
      this.routeSatelliteLayer = leaflet.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        {
          maxZoom: 19,
          attribution: 'Tiles &copy; Esri',
        },
      );
      this.updateRouteBaseLayer();
      map.on?.('zoomstart', () => {
        this.routeMapUserInteracted = true;
      });
      map.on?.('dragstart', () => {
        this.routeMapUserInteracted = true;
      });
      this.safeSetView(map, defaultCenter, 13);
      window.setTimeout(() => this.safeInvalidateSize(map), 80);
    }

    if (this.workTrackingMapElement && !this.workMap) {
      const map = leaflet.map(this.workTrackingMapElement, {
        attributionControl: false,
        zoomControl: true,
      });
      this.workMap = map;
      leaflet
        .tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
          attribution: '&copy; OpenStreetMap',
        })
        .addTo(map);
      this.safeSetView(map, defaultCenter, 15);
      window.setTimeout(() => this.safeInvalidateSize(map), 80);
    }

    this.updateLeafletMaps();
  }

  private updateLeafletMaps(): void {
    if (!this.routeMap && !this.workMap) return;
    if (this.routeMap && !this.isMapElementConnected(this.trackingMapElement)) {
      this.destroyRouteMap();
    }
    if (this.workMap && !this.isMapElementConnected(this.workTrackingMapElement)) {
      this.destroyWorkMap();
    }
    if (!this.routeMap && !this.workMap) return;

    const latitude = this.trackingLatitude();
    const longitude = this.trackingLongitude();
    if (!this.hasTrackingCoordinates() || latitude === null || longitude === null) {
      return;
    }

    const provider: [number, number] = [latitude, longitude];
    const destination = this.destinationCoordinates();
    const leaflet = window.L as LeafletNamespace | undefined;
    if (!leaflet) return;

    if (this.routeMap) {
      if (this.routeProviderMarker?.setLatLng) {
        this.routeProviderMarker.setLatLng(provider);
        this.routeProviderMarker.setIcon?.(this.leafletProviderIcon());
      } else {
        this.routeProviderMarker = leaflet
          .marker(provider, { icon: this.leafletProviderIcon() })
          .addTo(this.routeMap);
      }

      if (destination) {
        const destinationPoint: [number, number] = [destination.lat, destination.lng];
        if (this.routeDestinationMarker?.setLatLng) {
          this.routeDestinationMarker.setLatLng(destinationPoint);
        } else {
          this.routeDestinationMarker = leaflet
            .marker(destinationPoint, { icon: this.leafletDestinationIcon() })
            .addTo(this.routeMap);
        }

        this.loadRouteCoordinates(provider, destinationPoint);
        this.fitRouteOnce(provider, destinationPoint);
      } else {
        if (!this.routeMapUserInteracted) {
          this.safeSetView(this.routeMap, provider, 15);
        }
      }
    }

    if (this.workMap) {
      if (this.workProviderMarker?.setLatLng) {
        this.workProviderMarker.setLatLng(provider);
      } else {
        this.workProviderMarker = leaflet
          .marker(provider, { icon: this.leafletProviderIcon() })
          .addTo(this.workMap);
      }
      this.safeSetView(this.workMap, provider, 16);
      window.setTimeout(() => this.safeInvalidateSize(this.workMap), 80);
    }
  }

  private isMapElementConnected(element: HTMLElement | undefined): boolean {
    return !!element?.isConnected;
  }

  private safeSetView(
    map: LeafletMapInstance | undefined,
    center: [number, number],
    zoom: number,
  ): void {
    if (!map) return;

    try {
      map.setView(center, zoom);
    } catch {
      this.destroyDetachedMaps();
    }
  }

  private safeFitBounds(
    map: LeafletMapInstance | undefined,
    bounds: Array<[number, number]>,
    options?: Record<string, unknown>,
  ): void {
    if (!map?.fitBounds) return;

    try {
      map.fitBounds(bounds, options);
    } catch {
      this.destroyDetachedMaps();
    }
  }

  private safeInvalidateSize(map: LeafletMapInstance | undefined): void {
    if (!map) return;

    try {
      map.invalidateSize();
    } catch {
      this.destroyDetachedMaps();
    }
  }

  private destroyDetachedMaps(): void {
    if (!this.isMapElementConnected(this.trackingMapElement)) {
      this.destroyRouteMap();
    }
    if (!this.isMapElementConnected(this.workTrackingMapElement)) {
      this.destroyWorkMap();
    }
  }

  private destroyRouteMap(): void {
    try {
      this.routeMap?.remove();
    } catch {
      // Leaflet can throw if Angular already detached the pane.
    }
    this.routeMap = undefined;
    this.routeStreetLayer = undefined;
    this.routeSatelliteLayer = undefined;
    this.routeProviderMarker = undefined;
    this.routeDestinationMarker = undefined;
    this.routePolyline = undefined;
    this.routeAlternativePolylines = [];
    this.trackingMapElement = undefined;
    this.routeMapUserInteracted = false;
    this.routeAutoFitKey = '';
  }

  private destroyWorkMap(): void {
    try {
      this.workMap?.remove();
    } catch {
      // Leaflet can throw if Angular already detached the pane.
    }
    this.workMap = undefined;
    this.workProviderMarker = undefined;
    this.workTrackingMapElement = undefined;
  }

  private renderRoutePolyline(leaflet: LeafletNamespace): void {
    if (!this.routeMap || !leaflet.polyline) return;
    const createPolyline = leaflet.polyline;

    const points = this.routeCoordinates;
    if (points.length < 2) return;

    this.routeAlternativePolylines.forEach((polyline) => polyline.remove?.());
    this.routeAlternativePolylines = [];

    this.routeOptions
      .filter((option) => option.id !== this.selectedRouteId() && option.coordinates.length > 1)
      .forEach((option, index) => {
        const alternative = createPolyline(option.coordinates, {
            color: index === 0 ? '#f97316' : '#2f80ed',
            dashArray: index === 0 ? '14 8' : '8 8',
            lineCap: 'round',
            lineJoin: 'round',
            opacity: 0.86,
            weight: 7,
          })
          .addTo(this.routeMap as LeafletMapInstance);
        alternative.addEventListener?.('click', () => this.selectRouteAlternative(option.id));
        this.routeAlternativePolylines.push(alternative);
      });

    if (this.routePolyline?.setLatLngs) {
      this.routePolyline.setLatLngs(points);
      return;
    }

    this.routePolyline = createPolyline(points, {
        color: '#1eb980',
        lineCap: 'round',
        lineJoin: 'round',
        opacity: 0.95,
        weight: 6,
      })
      .addTo(this.routeMap);
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

    const url =
      `https://router.project-osrm.org/route/v1/driving/` +
      `${provider[1]},${provider[0]};${destinationPoint[1]},${destinationPoint[0]}` +
      '?alternatives=3&continue_straight=false&steps=false&overview=full&geometries=geojson';

    fetch(url, { headers: { Accept: 'application/json' } })
      .then((response) => (response.ok ? response.json() : null))
      .then((payload: {
        routes?: Array<{
          distance?: number;
          duration?: number;
          geometry?: { coordinates?: Array<[number, number]> };
        }>;
        waypoints?: Array<{ distance?: number }>;
      } | null) => {
        const routes = (payload?.routes ?? [])
          .map((route, index): RouteOption | null => {
            const coordinates = route.geometry?.coordinates
              ?.map(([lng, lat]) => [lat, lng] as [number, number])
              .filter(([lat, lng]) => this.isCoordinateInSenegal(lat, lng));
            if (!coordinates || coordinates.length < 2) return null;

            return {
              id: `route-${index}`,
              coordinates,
              distanceKm:
                typeof route.distance === 'number' ? Math.max(0.1, route.distance / 1000) : null,
              durationMinutes:
                typeof route.duration === 'number'
                  ? Math.max(1, Math.round(route.duration / 60))
                  : null,
            };
          })
          .filter((route): route is RouteOption => !!route)
          .sort((left, right) => (left.durationMinutes ?? 99999) - (right.durationMinutes ?? 99999));
        const route = routes[0];
        if (
          !route ||
          !this.hasReliableRoadSnap(payload?.waypoints) ||
          !this.isCoordinateInSenegal(provider[0], provider[1]) ||
          !this.isCoordinateInSenegal(destinationPoint[0], destinationPoint[1])
        ) {
          this.routeCoordinates = [];
          this.routeOptions = [];
          this.routeAlternatives.set([]);
          this.routePolyline?.remove?.();
          this.routePolyline = undefined;
          this.routeAlternativePolylines.forEach((polyline) => polyline.remove?.());
          this.routeAlternativePolylines = [];
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
          this.routePolyline?.remove?.();
          this.routePolyline = undefined;
          this.routeStatus.set('unavailable');
          return;
        }

        this.refreshRouteAlternatives();
        this.routeStatus.set(this.routeCoordinates.length > 1 ? 'ready' : 'unavailable');
        const leaflet = window.L as LeafletNamespace | undefined;
        if (leaflet) {
          this.renderRoutePolyline(leaflet);
        }
        this.updateLeafletMaps();
      })
      .catch(() => {
        this.routeCoordinates = [];
        this.routeOptions = [];
        this.routeAlternatives.set([]);
        this.routePolyline?.remove?.();
        this.routePolyline = undefined;
        this.routeAlternativePolylines.forEach((polyline) => polyline.remove?.());
        this.routeAlternativePolylines = [];
        this.routeDistanceKm.set(null);
        this.routeDurationMinutes.set(null);
        this.routeStatus.set('unavailable');
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

  private updateRouteBaseLayer(): void {
    if (!this.routeMap) return;

    const activeLayer = this.isSatelliteMapEnabled()
      ? this.routeSatelliteLayer
      : this.routeStreetLayer;
    const inactiveLayer = this.isSatelliteMapEnabled()
      ? this.routeStreetLayer
      : this.routeSatelliteLayer;

    if (inactiveLayer) {
      try {
        this.routeMap.removeLayer?.(inactiveLayer);
      } catch {
        // Leaflet ignores layers that are not currently attached.
      }
    }

    activeLayer?.addTo(this.routeMap);
  }

  private hasReliableRoadSnap(waypoints: Array<{ distance?: number }> | undefined): boolean {
    if (!waypoints || waypoints.length < 2) return true;

    return waypoints.every((waypoint) => {
      const distanceMeters = waypoint.distance;
      return (
        typeof distanceMeters === 'number' &&
        Number.isFinite(distanceMeters) &&
        distanceMeters <= 1500
      );
    });
  }

  private loadLeaflet(): Promise<LeafletNamespace> {
    if (window.L) return Promise.resolve(window.L);
    if (this.leafletLoadPromise) return this.leafletLoadPromise;

    this.leafletLoadPromise = new Promise<LeafletNamespace>((resolve, reject) => {
      const cssId = 'jokko-leaflet-css';
      if (!document.getElementById(cssId)) {
        const link = document.createElement('link');
        link.id = cssId;
        link.rel = 'stylesheet';
        link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
        document.head.appendChild(link);
      }

      const script = document.createElement('script');
      script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      script.async = true;
      script.onload = () => (window.L ? resolve(window.L) : reject(new Error('Leaflet absent')));
      script.onerror = () => reject(new Error('Impossible de charger Leaflet'));
      document.body.appendChild(script);
    });

    return this.leafletLoadPromise;
  }

  private fitRouteOnce(provider: [number, number], destinationPoint: [number, number]): void {
    if (!this.routeMap || this.routeMapUserInteracted) return;

    const key = `${this.routePointKey(provider)}|${this.routePointKey(destinationPoint)}`;
    if (this.routeAutoFitKey === key) return;
    this.routeAutoFitKey = key;
    this.safeFitBounds(this.routeMap, [provider, destinationPoint], { padding: [84, 84] });
  }

  private routePointKey(point: [number, number]): string {
    return point.map((value) => value.toFixed(5)).join(',');
  }

  private leafletProviderIcon(): unknown {
    return window.L?.divIcon({
      className: 'appointment-detail__leaflet-provider-pin',
      html: `<em>${this.routeRemainingBadgeLabel()}</em><span><i></i></span>`,
      iconAnchor: [21, 28],
      iconSize: [80, 58],
    });
  }

  private leafletDestinationIcon(): unknown {
    return window.L?.divIcon({
      className: 'appointment-detail__leaflet-destination-pin',
      html: '<span></span>',
      iconAnchor: [15, 30],
      iconSize: [30, 30],
    });
  }

  private resolveDestinationCoordinates(addressLabel: string): void {
    this.destinationCoordinates.set(null);
    this.destinationStatus.set('idle');
    this.routeStatus.set('idle');
    this.routeCoordinates = [];
    this.routeOptions = [];
    this.routeAlternatives.set([]);
    this.routeCoordinatesKey = '';
    this.routeAutoFitKey = '';
    this.routeMapUserInteracted = false;
    this.routeDestinationMarker?.remove?.();
    this.routePolyline?.remove?.();
    this.routeAlternativePolylines.forEach((polyline) => polyline.remove?.());
    this.routeDestinationMarker = undefined;
    this.routePolyline = undefined;
    this.routeAlternativePolylines = [];
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
      this.updateLeafletMaps();
      return;
    }

    this.destinationStatus.set('resolving');

    const params = new URLSearchParams({
      format: 'json',
      addressdetails: '1',
      countrycodes: 'sn',
      dedupe: '1',
      limit: '8',
      q: `${query}, Senegal`,
    });

    fetch(`https://nominatim.openstreetmap.org/search?${params.toString()}`, {
      headers: { Accept: 'application/json' },
    })
      .then((response) => (response.ok ? response.json() : []))
      .then((results: GeocodeCandidate[]) => {
        const best = this.selectBestDestinationCandidate(query, results);
        const lat = Number(best?.lat);
        const lng = Number(best?.lon);
        if (this.isCoordinateInSenegal(lat, lng)) {
          this.destinationCoordinates.set({ lat, lng });
          this.destinationStatus.set('ready');
          this.updateLeafletMaps();
          return;
        }
        this.destinationStatus.set('unavailable');
      })
      .catch(() => {
        this.destinationStatus.set('unavailable');
      });
  }

  private normalizeAddressQuery(value: string): string {
    return value
      .replace(/\([^)]*\)/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private extractCoordinatesFromAddress(value: string): LeafletLatLng | null {
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

  private selectBestDestinationCandidate(
    query: string,
    results: GeocodeCandidate[],
  ): GeocodeCandidate | null {
    const queryTokens = this.addressTokens(query);
    const candidates = results
      .filter((candidate) => {
        const lat = Number(candidate.lat);
        const lng = Number(candidate.lon);
        return (
          candidate.address?.country_code === 'sn' ||
          this.isCoordinateInSenegal(lat, lng)
        );
      })
      .map((candidate) => {
        const displayName = candidate.display_name ?? '';
        const displayTokens = this.addressTokens(displayName);
        const matched = queryTokens.filter((token) => displayTokens.includes(token)).length;
        const score =
          queryTokens.length === 0
            ? 0
            : matched / queryTokens.length + (candidate.importance ?? 0) * 0.08;

        return { candidate, score };
      })
      .sort((left, right) => right.score - left.score);

    const best = candidates[0];
    if (!best || best.score < 0.45) {
      return null;
    }

    return best.candidate;
  }

  private addressTokens(value: string): string[] {
    const stopWords = new Set([
      'adresse',
      'domicile',
      'senegal',
      'sn',
      'rue',
      'avenue',
      'av',
      'de',
      'du',
      'des',
      'la',
      'le',
      'les',
      'a',
    ]);

    return value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, ' ')
      .split(/\s+/)
      .map((token) => token.trim())
      .filter((token) => token.length > 1 && !stopWords.has(token));
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
        () => reject(new Error('Geolocation permission denied')),
        { enableHighAccuracy: true, timeout: 6000, maximumAge: 30000 },
      );
    });
  }
}
