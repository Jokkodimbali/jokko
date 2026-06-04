import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { Subscription, catchError, of, switchMap, timer } from 'rxjs';
import { AuthSessionService } from '../../../../../core/auth/auth-session.service';
import { AppFeedbackService } from '../../../../../core/feedback/app-feedback.service';
import { AppFooterComponent } from '../../../../../shared/ui/app-footer/app-footer.component';
import { AppNavbarComponent } from '../../../../../shared/ui/app-navbar/app-navbar.component';
import { AppointmentsService } from '../../../data-access/appointments.service';
import { AppointmentTrackingView, AppointmentView } from '../../../domain/appointments.models';

@Component({
  selector: 'app-appointment-detail-page',
  standalone: true,
  imports: [
    CommonModule,
    AppFooterComponent,
    AppNavbarComponent,
    LucideAngularModule,
    RouterLink,
  ],
  templateUrl: './appointment-detail-page.component.html',
  styleUrl: './appointment-detail-page.component.scss',
})
export class AppointmentDetailPageComponent implements OnDestroy, OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly appointmentsService = inject(AppointmentsService);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly feedback = inject(AppFeedbackService);
  private readonly authSession = inject(AuthSessionService);
  private trackingSubscription?: Subscription;
  private automaticStatusSubscription?: Subscription;

  protected readonly currentUser = this.authSession.currentUser;
  protected readonly appointment = signal<AppointmentView | null>(null);
  protected readonly tracking = signal<AppointmentTrackingView | null>(null);
  protected readonly isLoading = signal(true);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly alertEnabled = signal(false);
  protected readonly isUpdatingStatus = signal(false);
  protected readonly isHandlingPriceAdjustment = signal(false);
  protected readonly isSubmittingReview = signal(false);
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
  protected readonly isAppointmentCompleted = computed(() => this.appointment()?.status === 'TERMINEE');
  protected readonly currentPriceLabel = computed(() =>
    this.formatCurrency(this.appointment()?.agreedPrice ?? 0),
  );
  protected readonly finalPriceLabel = computed(() => {
    const appointment = this.appointment();
    return this.formatCurrency(
      appointment?.proposedAdjustedPrice ??
        appointment?.agreedPrice ??
        0,
    );
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
    return tracking?.presence.status === 'EN_PRESTATION' || this.appointment()?.status === 'EN_COURS';
  });
  protected readonly isProviderOnTheWay = computed(() => {
    if (this.isAppointmentCompleted()) return false;
    const tracking = this.tracking();
    return !this.isProviderWorking() && (tracking?.trackingStatus === 'EN_ROUTE' || tracking?.presence.status === 'EN_ROUTE');
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
  protected readonly mapEmbedUrl = computed<SafeResourceUrl | null>(() => {
    const latitude = this.trackingLatitude();
    const longitude = this.trackingLongitude();
    if (!this.hasTrackingCoordinates() || latitude === null || longitude === null) {
      return null;
    }

    const delta = 0.006;
    const url =
      `https://www.openstreetmap.org/export/embed.html?bbox=${longitude - delta}%2C${latitude - delta}%2C${longitude + delta}%2C${latitude + delta}&layer=mapnik&marker=${latitude}%2C${longitude}`;
    return this.sanitizer.bypassSecurityTrustResourceUrl(url);
  });
  protected readonly remainingDistanceLabel = computed(() => {
    const tracking = this.tracking();
    if (!this.isProviderOnTheWay()) return 'Suivi inactif';
    const speed = tracking?.lastSpeedKmh ?? tracking?.presence.lastSpeedKmh ?? null;
    const minutes = this.estimatedArrivalMinutes();

    if (speed && speed > 0 && minutes > 0) {
      const km = Math.max(0.4, (speed * minutes) / 60);
      return `${this.formatDistance(km)} restants`;
    }

    return this.hasTrackingCoordinates() ? 'Position recue en temps reel' : 'Position en attente';
  });
  protected readonly estimatedArrivalMinutes = computed(() => {
    const speed = this.tracking()?.lastSpeedKmh ?? this.tracking()?.presence.lastSpeedKmh ?? null;
    if (speed && speed > 0) {
      return Math.max(4, Math.min(45, Math.round(12 * (28 / Math.max(speed, 12)))));
    }

    return 0;
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

  ngOnDestroy(): void {
    this.trackingSubscription?.unsubscribe();
    this.automaticStatusSubscription?.unsubscribe();
  }

  protected goBack(): void {
    this.router.navigate(['/appointments']);
  }

  protected durationLabel(appointment: AppointmentView): string {
    return `${appointment.durationMinutes || 30} MIN`;
  }

  protected setRating(rating: number): void {
    this.selectedRating.set(rating);
    const appointment = this.appointment();
    if (!appointment || this.isSubmittingReview() || appointment.clientReviewedAt) return;

    this.isSubmittingReview.set(true);
    this.appointmentsService.submitReview(appointment.id, rating).subscribe({
      next: (updated) => {
        this.appointment.update((current) => this.mergeAppointment(current ?? appointment, updated));
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
        this.appointment.update((current) => this.mergeAppointment(current ?? appointment, updated));
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
        this.appointment.update((current) => this.mergeAppointment(current ?? appointment, updated));
        this.isHandlingPriceAdjustment.set(false);
        this.feedback.success('Ajustement du prix refuse.');
      },
      error: () => {
        this.isHandlingPriceAdjustment.set(false);
        this.feedback.error('Impossible de refuser cet ajustement pour le moment.');
      },
    });
  }

  protected async markOnTheWay(appointment: AppointmentView): Promise<void> {
    await this.transitionOnTheWay(appointment, false);
  }

  private async transitionOnTheWay(
    appointment: AppointmentView,
    silent: boolean,
  ): Promise<void> {
    if (this.isUpdatingStatus()) return;

    this.isUpdatingStatus.set(true);
    const location = await this.resolveCurrentLocation(appointment.addressLabel);
    this.appointmentsService.markProviderOnTheWay(appointment.id, location).subscribe({
      next: (tracking) => {
        this.tracking.set(tracking);
        this.isUpdatingStatus.set(false);
        if (!silent) {
          this.feedback.success('Statut mis a jour : prestataire en route.');
        }
      },
      error: () => {
        this.isUpdatingStatus.set(false);
        if (!silent) {
          this.feedback.error("Impossible d'activer le suivi en route. Verifiez que la reservation est payee.");
        }
      },
    });
  }

  protected startWork(appointment: AppointmentView): void {
    this.transitionStartWork(appointment, false);
  }

  private transitionStartWork(appointment: AppointmentView, silent: boolean): void {
    if (this.isUpdatingStatus()) return;

    this.isUpdatingStatus.set(true);
    this.appointmentsService.startAppointment(appointment.id).subscribe({
      next: (updated) => {
        this.appointment.update((current) => this.mergeAppointment(current ?? appointment, updated));
        this.refreshTracking(appointment.id);
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
        this.appointment.update((current) => this.mergeAppointment(current ?? appointment, updated));
        this.refreshTracking(appointment.id);
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
        this.startAutomaticStatusSync();
      },
      error: () => {
        this.errorMessage.set('Impossible de charger ce rendez-vous.');
        this.isLoading.set(false);
      },
    });
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
          this.tracking.set(tracking);
        }
      });
  }

  private startAutomaticStatusSync(): void {
    this.automaticStatusSubscription?.unsubscribe();
    this.automaticStatusSubscription = timer(0, 15000).subscribe(() => {
      void this.applyAutomaticStatusTransition();
    });
  }

  private async applyAutomaticStatusTransition(): Promise<void> {
    const appointment = this.appointment();
    if (!appointment || !this.canManageProviderStatus() || this.isUpdatingStatus()) {
      return;
    }

    const schedule = new Date(appointment.scheduledAt);
    if (Number.isNaN(schedule.getTime())) {
      return;
    }

    const now = Date.now();
    const startAt = schedule.getTime();
    const onTheWayAt = startAt - 30 * 60 * 1000;
    const finishAt = startAt + Math.max(15, appointment.durationMinutes || 30) * 60 * 1000;

    if (
      appointment.status === 'PAYEE_SEQUESTRE' &&
      !this.isProviderOnTheWay() &&
      !this.isProviderWorking() &&
      now >= onTheWayAt
    ) {
      await this.transitionOnTheWay(appointment, true);
      return;
    }

    if (
      appointment.status === 'PAYEE_SEQUESTRE' &&
      this.isProviderOnTheWay() &&
      now >= startAt
    ) {
      this.transitionStartWork(appointment, true);
      return;
    }

    if (appointment.status === 'EN_COURS' && now >= finishAt) {
      this.transitionCompleteWork(appointment, true);
    }
  }

  private refreshTracking(appointmentId: string): void {
    this.appointmentsService
      .getAppointmentTracking(appointmentId)
      .pipe(catchError(() => of(null)))
      .subscribe((tracking) => {
        if (tracking) {
          this.tracking.set(tracking);
        }
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
    }).format(value || 0)} FCFA`;
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

  private resolveCurrentLocation(fallbackLabel: string): Promise<{
    latitude?: number;
    longitude?: number;
    accuracyMeters?: number | null;
    headingDegrees?: number | null;
    speedKmh?: number | null;
    locationLabel?: string | null;
  }> {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      return Promise.resolve(this.defaultTrackingLocation(fallbackLabel));
    }

    return new Promise((resolve) => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracyMeters: position.coords.accuracy,
            headingDegrees:
              typeof position.coords.heading === 'number'
                ? position.coords.heading
                : null,
            speedKmh:
              typeof position.coords.speed === 'number'
                ? position.coords.speed * 3.6
                : null,
            locationLabel: fallbackLabel,
          });
        },
        () => resolve(this.defaultTrackingLocation(fallbackLabel)),
        { enableHighAccuracy: true, timeout: 6000, maximumAge: 30000 },
      );
    });
  }

  private defaultTrackingLocation(locationLabel: string) {
    return {
      accuracyMeters: null,
      headingDegrees: null,
      speedKmh: null,
      locationLabel,
    };
  }
}
