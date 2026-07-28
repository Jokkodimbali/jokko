import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ActivatedRoute } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { AppStarRatingComponent } from '../../../../../shared/ui/app-star-rating/app-star-rating.component';
import { AppFeedbackService } from '../../../../../core/feedback/app-feedback.service';
import { getHttpErrorMessage } from '../../../../../core/http/api-response.utils';
import { BackNavigationService } from '../../../../../core/navigation/back-navigation.service';
import { safeInternalUrl } from '../../../../../shared/utils/safe-internal-url';
import { userInitials } from '../../../../../shared/utils/user-initials';
import { MessagesService } from '../../../../messages/data-access/messages.service';
import { AppointmentsService } from '../../../data-access/appointments.service';
import { AppointmentView, PaymentMethod } from '../../../domain/appointments.models';

interface PaymentOption {
  id: PaymentMethod;
  label: string;
  logoUrl: string;
  subtitle: string;
}

@Component({
  selector: 'app-appointment-payment-page',
  standalone: true,
  imports: [CommonModule, LucideAngularModule, AppStarRatingComponent],
  templateUrl: './appointment-payment-page.component.html',
  styleUrl: './appointment-payment-page.component.scss',
})
export class AppointmentPaymentPageComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly backNavigation = inject(BackNavigationService);
  private readonly appointmentsService = inject(AppointmentsService);
  private readonly messagesService = inject(MessagesService);
  private readonly feedback = inject(AppFeedbackService);

  protected readonly appointment = signal<AppointmentView | null>(null);
  protected readonly selectedMethod = signal<PaymentMethod>('WAVE');
  protected readonly isLoading = signal(true);
  protected readonly isPaying = signal(false);
  protected readonly isCancelling = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  protected readonly paymentOptions: PaymentOption[] = [
    { id: 'WAVE', label: 'Wave', logoUrl: '/wave.png', subtitle: 'Paiement mobile instantane' },
    { id: 'ORANGE_MONEY', label: 'Orange Money', logoUrl: '/Orange-Money-logo.png', subtitle: 'Transfert depuis votre mobile' },
    { id: 'CARD', label: 'Carte bancaire', logoUrl: '/logo vissa.avif', subtitle: 'Visa, Mastercard acceptes' },
  ];

  protected readonly amountValueLabel = computed(() =>
    new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 })
      .format(this.appointment()?.agreedPrice ?? 0)
      .replace(/\s/g, ' '),
  );
  protected readonly isPaymentConfirmed = computed(() => {
    const status = this.appointment()?.status;
    return status === 'PAYEE_SEQUESTRE' || status === 'EN_COURS' || status === 'TERMINEE';
  });
  protected readonly isMedicinePaymentFlow = computed(() => this.isMedicineFlow());
  protected readonly counterpartRoleLabel = computed(() =>
    this.isMedicinePaymentFlow() ? 'Medecin' : 'Prestataire',
  );
  protected readonly comparisonLabel = computed(() => {
    const appointment = this.appointment();
    const servicePrice = this.toPositiveAmount(appointment?.servicePrice);
    const agreedPrice = this.toPositiveAmount(appointment?.agreedPrice);

    if (!servicePrice) {
      return 'Prix initial';
    }

    if (!agreedPrice || servicePrice === agreedPrice) {
      return 'Difference';
    }

    return agreedPrice < servicePrice ? 'Economie' : 'Ajustement';
  });
  protected readonly comparisonAmountLabel = computed(() => {
    const appointment = this.appointment();
    const servicePrice = this.toPositiveAmount(appointment?.servicePrice);
    const agreedPrice = this.toPositiveAmount(appointment?.agreedPrice);

    if (!servicePrice) {
      return 'A confirmer';
    }

    if (!agreedPrice || servicePrice === agreedPrice) {
      return '0 FCFA';
    }

    const difference = Math.abs(servicePrice - agreedPrice);
    const sign = agreedPrice < servicePrice ? '-' : '+';
    return `${sign} ${this.formatAmountValue(difference)} FCFA`;
  });
  protected readonly basePriceLabel = computed(() => {
    const appointment = this.appointment();
    const servicePrice = this.toPositiveAmount(appointment?.servicePrice);
    return servicePrice ? `${this.formatAmountValue(servicePrice)} FCFA` : 'A confirmer';
  });
  protected readonly hasNegotiatedDiscount = computed(() => {
    const appointment = this.appointment();
    const servicePrice = this.toPositiveAmount(appointment?.servicePrice);
    const agreedPrice = this.toPositiveAmount(appointment?.agreedPrice);
    return Boolean(servicePrice && agreedPrice && agreedPrice < servicePrice);
  });
  protected readonly savingsBannerLabel = computed(() => {
    const appointment = this.appointment();
    const servicePrice = this.toPositiveAmount(appointment?.servicePrice);
    const agreedPrice = this.toPositiveAmount(appointment?.agreedPrice);
    if (servicePrice && agreedPrice && agreedPrice < servicePrice) {
      return `Vous economisez ${this.formatAmountValue(servicePrice - agreedPrice)} FCFA`;
    }
    return 'Votre reservation est prete a etre finalisee';
  });
  protected readonly acceptedOfferBannerTitle = computed(() => {
    const appointment = this.appointment();
    const name = appointment?.doctorName || this.counterpartRoleLabel().toLowerCase();
    return `Vous avez accepte l'offre de ${name}`;
  });
  protected readonly providerRatingShortLabel = computed(() => {
    const appointment = this.appointment();
    const rating = this.toPositiveAmount(appointment?.professionalRating);
    if (!rating) {
      return 'Nouveau';
    }

    return new Intl.NumberFormat('fr-FR', {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    })
      .format(rating)
      .replace(/\s/g, ' ');
  });

  ngOnInit(): void {
    const reservationId = this.route.snapshot.paramMap.get('id');

    if (!reservationId) {
      this.router.navigate(['/appointments']);
      return;
    }

    this.loadAppointment(reservationId);
  }

  protected goBack(): void {
    const appointment = this.appointment();
    const fallback = appointment?.id ? `/appointments/${appointment.id}` : '/appointments';
    this.backNavigation.back(this.safeReturnUrl(), fallback, { preferReturnUrl: true });
  }

  protected selectMethod(method: PaymentMethod): void {
    this.selectedMethod.set(method);
  }

  protected avatarInitials(appointment: AppointmentView): string {
    return userInitials(appointment.doctorName, 'JD');
  }

  protected pay(): void {
    const appointment = this.appointment();

    if (!appointment || this.isPaying()) {
      return;
    }

    if (!appointment.agreedPrice || appointment.agreedPrice <= 0) {
      this.errorMessage.set('Le prix convenu est manquant pour ce rendez-vous.');
      return;
    }

    this.isPaying.set(true);
    this.errorMessage.set(null);

    this.appointmentsService.initiatePayment(
      appointment.id,
      this.selectedMethod(),
      this.buildPaymentRedirectOptions(appointment),
    ).subscribe({
      next: (payment) => {
        this.isPaying.set(false);
        this.feedback.success('Paiement initialise avec succes.');

        if (this.canRedirectToPaymentUrl(payment.paymentUrl)) {
          window.location.href = payment.paymentUrl;
          return;
        }

        if (payment.paymentUrl) {
          this.feedback.success(
            'Paiement simule confirme pour le test web.',
          );
          this.appointmentsService.markAppointmentAsPaid(appointment.id).subscribe({
            next: (paidAppointment) => this.handlePaidAppointment(paidAppointment),
            error: () => this.navigateAfterPayment(appointment, 'PAYEE_SEQUESTRE'),
          });
          return;
        }

        this.router.navigate(['/appointments', appointment.id]);
      },
      error: (error) => {
        this.handlePaymentInitiationError(error, appointment);
      },
    });
  }

  protected cancelReservation(): void {
    const appointment = this.appointment();

    if (!appointment || this.isCancelling()) {
      return;
    }

    this.isCancelling.set(true);
    this.errorMessage.set(null);

    this.appointmentsService.cancelAppointment(
      appointment.id,
      'Annulation demandee depuis la page de paiement.',
    ).subscribe({
      next: () => {
        this.feedback.success('Reservation annulee.');
        this.router.navigate(['/appointments']);
      },
      error: (error) => {
        this.errorMessage.set(getHttpErrorMessage(error, "Impossible d'annuler cette reservation."));
        this.isCancelling.set(false);
      },
    });
  }

  protected messageProvider(): void {
    const appointment = this.appointment();
    if (!appointment) {
      return;
    }

    this.messagesService.createConversation({ professionalProfileId: appointment.professionalId }).subscribe({
      next: (conversation) => {
        this.router.navigate(['/messages'], {
          queryParams: {
            conversationId: conversation.id,
            professionalId: appointment.professionalId,
            providerName: appointment.doctorName,
            serviceName: appointment.serviceName,
            amount: appointment.agreedPrice ?? 0,
            reservationId: appointment.id,
            appointmentDate: appointment.scheduledAt,
            address: appointment.addressLabel,
            status: appointment.status,
          },
        });
      },
      error: (error) => {
        this.feedback.error(
          getHttpErrorMessage(
            error,
            this.isMedicinePaymentFlow()
              ? "Impossible d'ouvrir la discussion avec ce medecin."
              : "Impossible d'ouvrir la discussion avec ce prestataire.",
          ),
        );
      },
    });
  }

  protected openAppointmentPage(appointment: AppointmentView): void {
    this.router.navigate(['/appointments', appointment.id], {
      queryParams: { returnUrl: '/appointments' },
    });
  }

  private handlePaidAppointment(appointment: AppointmentView): void {
    this.isPaying.set(false);
    if (!this.shouldReturnToMessages()) {
      this.appointment.set(appointment);
      this.router.navigateByUrl(this.withQueryParams(this.paymentConfirmationPath(appointment), {
        confirmed: '1',
        returnUrl: this.safeReturnUrl() ?? '/appointments',
      }), { replaceUrl: true });
      return;
    }

    this.messagesService.createConversation({ professionalProfileId: appointment.professionalId }).subscribe({
      next: (conversation) => {
        const message = [
          `Paiement confirme pour ${appointment.serviceName}.`,
          `Montant paye: ${this.formatAmount(appointment.agreedPrice ?? 0)}.`,
          `Rendez-vous le ${this.formatPaymentDate(appointment)} a ${appointment.timeLabel}.`,
        ].join(' ');

        this.messagesService.sendMessage(conversation.id, message).subscribe({
          next: () => this.navigateAfterPayment(appointment, 'PAYEE_SEQUESTRE', conversation.id),
          error: () => this.navigateAfterPayment(appointment, 'PAYEE_SEQUESTRE', conversation.id),
        });
      },
      error: () => this.navigateAfterPayment(appointment, 'PAYEE_SEQUESTRE'),
    });
  }

  private handlePaymentInitiationError(error: unknown, appointment: AppointmentView): void {
    const errorCode = (error as { error?: { errorCode?: string } })?.error?.errorCode;
    if (errorCode === 'PAYMENT_ALREADY_PROCESSED') {
      this.feedback.info('Paiement deja initie. Confirmation de la reservation en cours.');
      this.appointmentsService.markAppointmentAsPaid(appointment.id).subscribe({
        next: (paidAppointment) => this.handlePaidAppointment(paidAppointment),
        error: (markPaidError) => {
          this.errorMessage.set(
            getHttpErrorMessage(markPaidError, 'Paiement deja initie, mais la reservation na pas pu etre confirmee.'),
          );
          this.isPaying.set(false);
        },
      });
      return;
    }

    this.errorMessage.set(getHttpErrorMessage(error, "Impossible d'initialiser le paiement."));
    this.isPaying.set(false);
  }

  private buildPaymentRedirectOptions(appointment: AppointmentView): {
    successPath?: string;
    cancelPath?: string;
  } | undefined {
    if (this.shouldReturnToMessages()) {
      return {
        successPath: this.buildMessagesPath(appointment, 'PAYEE_SEQUESTRE'),
        cancelPath: this.router.url,
      };
    }

    if (!this.isMedicineFlow()) {
      return undefined;
    }

    return {
      successPath: this.paymentConfirmationPath(appointment),
      cancelPath: this.paymentPath(appointment),
    };
  }

  private navigateAfterPayment(
    appointment: AppointmentView,
    status: string,
    conversationId?: string,
  ): void {
    if (!this.shouldReturnToMessages()) {
      this.router.navigateByUrl(this.paymentConfirmationPath(appointment));
      return;
    }

    this.router.navigate(['/messages'], {
      queryParams: this.buildMessagesQueryParams(appointment, status, conversationId),
    });
  }

  private buildMessagesPath(appointment: AppointmentView, status: string): string {
    const params = new URLSearchParams();
    const queryParams = this.buildMessagesQueryParams(appointment, status);
    Object.entries(queryParams).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        params.set(key, String(value));
      }
    });

    const query = params.toString();
    return query ? `/messages?${query}` : '/messages';
  }

  private buildMessagesQueryParams(
    appointment: AppointmentView,
    status: string,
    conversationId = this.route.snapshot.queryParamMap.get('conversationId') || undefined,
  ): Record<string, string | number | undefined> {
    return {
      conversationId,
      returnTo: 'messages',
      professionalId: appointment.professionalId,
      providerName: appointment.doctorName,
      serviceName: appointment.serviceName,
      amount: appointment.agreedPrice ?? 0,
      reservationId: appointment.id,
      appointmentDate: appointment.scheduledAt,
      address: appointment.addressLabel,
      status,
    };
  }

  private shouldReturnToMessages(): boolean {
    return this.route.snapshot.queryParamMap.get('returnTo') === 'messages';
  }

  private isMedicineFlow(): boolean {
    const source = this.route.snapshot.queryParamMap.get('source')?.toLowerCase();
    return this.router.url.startsWith('/medecine/reservations/') || source === 'medecine' || source === 'medicine';
  }

  private paymentPath(appointment: AppointmentView): string {
    if (this.isMedicineFlow()) {
      return `/medecine/reservations/${appointment.id}/paiement?source=medecine`;
    }

    return `/appointments/${appointment.id}/payment`;
  }

  private paymentConfirmationPath(appointment: AppointmentView): string {
    if (this.isMedicineFlow()) {
      return `/medecine/reservations/${appointment.id}/confirmation?source=medecine`;
    }

    return `/appointments/${appointment.id}/payment`;
  }

  private withQueryParams(path: string, params: Record<string, string>): string {
    const [pathname, existingQuery = ''] = path.split('?');
    const searchParams = new URLSearchParams(existingQuery);
    Object.entries(params).forEach(([key, value]) => {
      if (value) {
        searchParams.set(key, value);
      }
    });
    const query = searchParams.toString();
    return query ? `${pathname}?${query}` : pathname;
  }

  private safeReturnUrl(): string | null {
    return safeInternalUrl(this.route.snapshot.queryParamMap.get('returnUrl'));
  }

  protected formatPaymentDate(appointment: AppointmentView): string {
    const date = new Date(appointment.scheduledAt);
    if (Number.isNaN(date.getTime())) {
      return 'Date a confirmer';
    }

    return new Intl.DateTimeFormat('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })
      .format(date)
      .toUpperCase()
      .replace('.', '');
  }

  protected confirmedServiceLabel(appointment: AppointmentView): string {
    return this.firstDisplayLabel(
      appointment.serviceName,
      appointment.specialty,
      appointment.professionalSubCategoryName,
      appointment.serviceCategoryName,
      this.isMedicinePaymentFlow() ? 'Consultation medicale' : 'Prestation confirmee',
    );
  }

  protected confirmedProviderSubtitle(appointment: AppointmentView): string {
    return this.firstDisplayLabel(
      appointment.specialty,
      appointment.professionalSubCategoryName,
      appointment.serviceCategoryName,
      this.confirmedServiceLabel(appointment),
    );
  }

  protected confirmedDateLabel(appointment: AppointmentView): string {
    const formatted = this.formatPaymentDate(appointment);
    return this.firstDisplayLabel(
      formatted,
      appointment.shortDateLabel,
      appointment.fullDateLabel,
      'Date a confirmer',
    );
  }

  protected confirmedTimeLabel(appointment: AppointmentView): string {
    if (!this.isPlaceholderLabel(appointment.timeLabel)) {
      return appointment.timeLabel;
    }

    const date = new Date(appointment.scheduledAt);
    if (!Number.isNaN(date.getTime())) {
      return new Intl.DateTimeFormat('fr-FR', {
        hour: '2-digit',
        minute: '2-digit',
      })
        .format(date)
        .replace(':', 'h');
    }

    return 'Heure a confirmer';
  }

  protected methodAriaLabel(option: PaymentOption): string {
    return `Payer avec ${option.label}`;
  }

  protected paymentOptionSubtitle(option: PaymentOption): string {
    return option.subtitle;
  }

  protected formatPaymentLongDate(appointment: AppointmentView): string {
    const date = new Date(appointment.scheduledAt);
    if (Number.isNaN(date.getTime())) {
      return appointment.fullDateLabel || 'Date a confirmer';
    }

    return new Intl.DateTimeFormat('fr-FR', {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      year: 'numeric',
    })
      .format(date)
      .replace(/^\p{Ll}/u, (char) => char.toUpperCase());
  }

  private loadAppointment(reservationId: string): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);

    this.appointmentsService.getAppointmentById(reservationId).subscribe({
      next: (appointment) => {
        this.appointment.set(this.withPaymentDisplayLabels(appointment));
        this.isLoading.set(false);
      },
      error: () => {
        this.errorMessage.set('Impossible de charger le rendez-vous a payer.');
        this.isLoading.set(false);
      },
    });
  }

  private formatAmount(value: number): string {
    return `${this.formatAmountValue(value)} FCFA`;
  }

  private formatAmountValue(value: number): string {
    return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 })
      .format(value || 0)
      .replace(/\s/g, ' ');
  }

  private toPositiveAmount(value: number | null | undefined): number | null {
    const amount = Number(value ?? 0);
    return Number.isFinite(amount) && amount > 0 ? Math.trunc(amount) : null;
  }

  private withPaymentDisplayLabels(appointment: AppointmentView): AppointmentView {
    const serviceName = this.confirmedServiceLabel(appointment);
    const specialty = this.confirmedProviderSubtitle({ ...appointment, serviceName });

    return {
      ...appointment,
      serviceName,
      specialty,
      timeLabel: this.confirmedTimeLabel(appointment),
    };
  }

  private firstDisplayLabel(...values: Array<string | null | undefined>): string {
    return values.find((value) => !this.isPlaceholderLabel(value))?.trim() ?? 'Prestation confirmee';
  }

  private isPlaceholderLabel(value: string | null | undefined): boolean {
    if (!value) {
      return true;
    }

    const normalized = value
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');

    return (
      normalized.length === 0 ||
      normalized === 'a confirmer' ||
      normalized.includes('non rense') ||
      normalized.includes('rendez-vous non') ||
      normalized.includes('rendez vous non')
    );
  }

  private canRedirectToPaymentUrl(paymentUrl?: string): boolean {
    if (!paymentUrl) return false;

    try {
      const parsedUrl = new URL(paymentUrl);
      return parsedUrl.protocol === 'http:' || parsedUrl.protocol === 'https:';
    } catch {
      return false;
    }
  }
}
