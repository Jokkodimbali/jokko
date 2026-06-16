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
import { Subscription, catchError, of, switchMap, timer } from 'rxjs';
import { AuthSessionService } from '../../../../../core/auth/auth-session.service';
import { AppFeedbackService } from '../../../../../core/feedback/app-feedback.service';
import { AppFooterComponent } from '../../../../../shared/ui/app-footer/app-footer.component';
import { AppNavbarComponent } from '../../../../../shared/ui/app-navbar/app-navbar.component';
import { AppointmentsService } from '../../../data-access/appointments.service';
import { AppointmentTrackingView, AppointmentView } from '../../../domain/appointments.models';
import { AppointmentDetailLoadingComponent } from '../../components/appointment-detail-loading/appointment-detail-loading.component';
import { ReservationNegotiationComponent } from '../../components/reservation-negotiation/reservation-negotiation.component';

type LeafletLatLng = { lat: number; lng: number };
type LeafletNamespace = NonNullable<Window['L']> & {
  polyline?: (
    latlngs: Array<[number, number]>,
    options?: Record<string, unknown>,
  ) => LeafletLayerInstance;
};
type LeafletMapInstance = ReturnType<NonNullable<Window['L']>['map']> & {
  fitBounds?: (bounds: Array<[number, number]>, options?: Record<string, unknown>) => void;
};
type LeafletLayerInstance = {
  addTo(map: LeafletMapInstance): LeafletLayerInstance;
  remove?: () => void;
  setLatLng?: (latlng: [number, number]) => void;
  setLatLngs?: (latlngs: Array<[number, number]>) => void;
};

@Component({
  selector: 'app-appointment-detail-page',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    AppFooterComponent,
    AppNavbarComponent,
    AppointmentDetailLoadingComponent,
    LucideAngularModule,
    ReservationNegotiationComponent,
  ],
  templateUrl: './appointment-detail-page.component.html',
  styleUrl: './appointment-detail-page.component.scss',
})
export class AppointmentDetailPageComponent implements AfterViewInit, OnDestroy, OnInit {
  @ViewChild('trackingMap')
  private set trackingMapRef(value: ElementRef<HTMLElement> | undefined) {
    if (!value) {
      this.destroyRouteMap();
      return;
    }

    this.trackingMapElement = value?.nativeElement;
    window.setTimeout(() => void this.initializeLeafletMaps(), 0);
  }

  @ViewChild('workTrackingMap')
  private set workTrackingMapRef(value: ElementRef<HTMLElement> | undefined) {
    if (!value) {
      this.destroyWorkMap();
      return;
    }

    this.workTrackingMapElement = value?.nativeElement;
    window.setTimeout(() => void this.initializeLeafletMaps(), 0);
  }

  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly appointmentsService = inject(AppointmentsService);
  private readonly feedback = inject(AppFeedbackService);
  private readonly authSession = inject(AuthSessionService);
  private trackingSubscription?: Subscription;
  private leafletLoadPromise?: Promise<LeafletNamespace>;
  private routeMap?: LeafletMapInstance;
  private workMap?: LeafletMapInstance;
  private routeProviderMarker?: LeafletLayerInstance;
  private routeDestinationMarker?: LeafletLayerInstance;
  private routePolyline?: LeafletLayerInstance;
  private workProviderMarker?: LeafletLayerInstance;
  private providerLocationWatchId: number | null = null;
  private lastProviderLocationPushAt = 0;
  private routeCoordinates: Array<[number, number]> = [];
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
  protected readonly invoiceNumberLabel = computed(() => {
    const appointmentId = this.appointment()?.id ?? '';
    const suffix = appointmentId.replace(/-/g, '').slice(-4).toUpperCase();
    return `Facture Numero ${suffix || '----'}`;
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
    if (this.isAppointmentCompleted()) return false;
    const tracking = this.tracking();
    return (
      tracking?.presence.status === 'EN_PRESTATION' || this.appointment()?.status === 'EN_COURS'
    );
  });
  protected readonly isProviderOnTheWay = computed(() => {
    if (this.isAppointmentCompleted()) return false;
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
    () =>
      typeof this.trackingLatitude() === 'number' &&
      Number.isFinite(this.trackingLatitude()) &&
      typeof this.trackingLongitude() === 'number' &&
      Number.isFinite(this.trackingLongitude()),
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
    const minutes = this.estimatedArrivalMinutes();
    if (minutes <= 0) return 0;
    return Math.max(18, Math.min(82, 100 - minutes * 4));
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
    this.router.navigateByUrl(returnUrl || '/appointments');
  }

  protected durationLabel(appointment: AppointmentView): string {
    return `${appointment.durationMinutes || 30} MIN`;
  }

  protected avatarInitials(appointment: AppointmentView): string {
    return (
      appointment.doctorName
        .split(' ')
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase())
        .join('') || 'JD'
    );
  }

  protected serviceDescriptionLabel(appointment: AppointmentView): string {
    return (
      appointment.notes?.trim() || 'Aucune note particuliere n a ete ajoutee a ce rendez-vous.'
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
    this.isUpdatingStatus.set(true);
    this.appointmentsService.markNoShow(appointment.id).subscribe({
      next: (updated) => {
        this.appointment.update((current) =>
          this.mergeAppointment(current ?? appointment, updated),
        );
        this.isUpdatingStatus.set(false);
        this.feedback.success('Absence signalee sur ce rendez-vous.');
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
    const location = await this.resolveCurrentLocation(appointment.addressLabel).catch(() => null);
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
            locationLabel: this.appointment()?.addressLabel ?? null,
          })
          .pipe(catchError(() => of(null)))
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

  private async initializeLeafletMaps(): Promise<void> {
    if (typeof window === 'undefined') return;
    const leaflet = await this.loadLeaflet();
    const defaultCenter: [number, number] = [14.7167, -17.4677];

    if (this.trackingMapElement && !this.routeMap) {
      this.routeMap = leaflet.map(this.trackingMapElement, {
        attributionControl: false,
        zoomControl: true,
      });
      leaflet
        .tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
          attribution: '&copy; OpenStreetMap',
        })
        .addTo(this.routeMap);
      this.safeSetView(this.routeMap, defaultCenter, 13);
      window.setTimeout(() => this.safeInvalidateSize(this.routeMap), 80);
    }

    if (this.workTrackingMapElement && !this.workMap) {
      this.workMap = leaflet.map(this.workTrackingMapElement, {
        attributionControl: false,
        zoomControl: true,
      });
      leaflet
        .tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 19,
          attribution: '&copy; OpenStreetMap',
        })
        .addTo(this.workMap);
      this.safeSetView(this.workMap, defaultCenter, 15);
      window.setTimeout(() => this.safeInvalidateSize(this.workMap), 80);
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
        this.safeFitBounds(this.routeMap, [provider, destinationPoint], { padding: [44, 44] });
      } else {
        this.safeSetView(this.routeMap, provider, 15);
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
    this.routeProviderMarker = undefined;
    this.routeDestinationMarker = undefined;
    this.routePolyline = undefined;
    this.trackingMapElement = undefined;
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

  private renderRoutePolyline(
    leaflet: LeafletNamespace,
    provider: [number, number],
    destinationPoint: [number, number],
  ): void {
    if (!this.routeMap || !leaflet.polyline) return;

    const points = this.routeCoordinates.length > 1 ? this.routeCoordinates : [provider, destinationPoint];
    if (this.routePolyline?.setLatLngs) {
      this.routePolyline.setLatLngs(points);
      return;
    }

    this.routePolyline = leaflet
      .polyline(points, {
        color: '#1eb980',
        lineCap: 'round',
        lineJoin: 'round',
        opacity: 0.95,
        weight: 6,
      })
      .addTo(this.routeMap);
  }

  private loadRouteCoordinates(provider: [number, number], destinationPoint: [number, number]): void {
    const key = `${provider.join(',')}|${destinationPoint.join(',')}`;
    if (this.routeCoordinatesKey === key) return;
    this.routeCoordinatesKey = key;
    this.routeCoordinates = [];
    this.routeDistanceKm.set(null);
    this.routeDurationMinutes.set(null);
    this.routeStatus.set('calculating');

    const url =
      `https://router.project-osrm.org/route/v1/driving/` +
      `${provider[1]},${provider[0]};${destinationPoint[1]},${destinationPoint[0]}` +
      '?overview=full&geometries=geojson';

    fetch(url, { headers: { Accept: 'application/json' } })
      .then((response) => (response.ok ? response.json() : null))
      .then((payload: {
        routes?: Array<{
          distance?: number;
          duration?: number;
          geometry?: { coordinates?: Array<[number, number]> };
        }>;
      } | null) => {
        const route = payload?.routes?.[0];
        const coordinates = route?.geometry?.coordinates;
        if (!coordinates?.length) {
          this.routeStatus.set('unavailable');
          return;
        }

        this.routeCoordinates = coordinates
          .map(([lng, lat]) => [lat, lng] as [number, number])
          .filter(([lat, lng]) => Number.isFinite(lat) && Number.isFinite(lng));
        this.routeDistanceKm.set(
          typeof route?.distance === 'number' ? Math.max(0.1, route.distance / 1000) : null,
        );
        this.routeDurationMinutes.set(
          typeof route?.duration === 'number' ? Math.max(1, Math.round(route.duration / 60)) : null,
        );
        this.routeStatus.set(this.routeCoordinates.length > 1 ? 'ready' : 'unavailable');
        const leaflet = window.L as LeafletNamespace | undefined;
        if (leaflet) {
          this.renderRoutePolyline(leaflet, provider, destinationPoint);
        }
        this.updateLeafletMaps();
      })
      .catch(() => {
        this.routeStatus.set('unavailable');
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

  private leafletProviderIcon(): unknown {
    return window.L?.divIcon({
      className: 'appointment-detail__leaflet-provider-pin',
      html: '<span><i></i></span>',
      iconAnchor: [18, 18],
      iconSize: [36, 36],
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
    this.routeCoordinatesKey = '';
    this.routeDistanceKm.set(null);
    this.routeDurationMinutes.set(null);
    const query = addressLabel?.trim();
    if (!query || typeof window === 'undefined') return;
    this.destinationStatus.set('resolving');

    const params = new URLSearchParams({
      format: 'json',
      limit: '1',
      q: `${query}, Senegal`,
    });

    fetch(`https://nominatim.openstreetmap.org/search?${params.toString()}`, {
      headers: { Accept: 'application/json' },
    })
      .then((response) => (response.ok ? response.json() : []))
      .then((results: Array<{ lat?: string; lon?: string }>) => {
        const first = results[0];
        const lat = Number(first?.lat);
        const lng = Number(first?.lon);
        if (Number.isFinite(lat) && Number.isFinite(lng)) {
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

  private mergeAppointment(current: AppointmentView, updated: AppointmentView): AppointmentView {
    return {
      ...current,
      ...updated,
      doctorName: current.doctorName,
      specialty: current.specialty,
      avatarUrl: current.avatarUrl,
      serviceName: current.serviceName,
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
