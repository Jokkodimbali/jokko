import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ActivatedRoute } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { AuthSessionService } from '../../../../../core/auth/auth-session.service';
import { AppFeedbackService } from '../../../../../core/feedback/app-feedback.service';
import { getHttpErrorMessage } from '../../../../../core/http/api-response.utils';
import { BackNavigationService } from '../../../../../core/navigation/back-navigation.service';
import { userInitials } from '../../../../../shared/utils/user-initials';
import { MessagesService } from '../../../../messages/data-access/messages.service';
import { AppointmentsService } from '../../../data-access/appointments.service';
import { AppointmentView, PaymentMethod } from '../../../domain/appointments.models';

interface PaymentOption {
  id: PaymentMethod;
  label: string;
  logoUrl: string;
}

@Component({
  selector: 'app-appointment-payment-page',
  standalone: true,
  imports: [CommonModule, LucideAngularModule],
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
  private readonly authSession = inject(AuthSessionService);

  protected readonly currentUser = this.authSession.currentUser;
  protected readonly appointment = signal<AppointmentView | null>(null);
  protected readonly selectedMethod = signal<PaymentMethod>('WAVE');
  protected readonly isLoading = signal(true);
  protected readonly isPaying = signal(false);
  protected readonly isCancelling = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  protected readonly paymentOptions: PaymentOption[] = [
    { id: 'WAVE', label: 'Wave', logoUrl: '/wave.png' },
    { id: 'ORANGE_MONEY', label: 'Orange Money', logoUrl: '/Orange-Money-logo.png' },
    { id: 'CARD', label: 'Carte bancaire', logoUrl: '/logo vissa.avif' },
  ];

  protected readonly amountLabel = computed(() =>
    this.formatAmount(this.appointment()?.agreedPrice ?? 0),
  );

  protected readonly amountValueLabel = computed(() =>
    new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 })
      .format(this.appointment()?.agreedPrice ?? 0)
      .replace(/\s/g, ' '),
  );
  protected readonly isPaymentConfirmed = computed(() => {
    const status = this.appointment()?.status;
    return status === 'PAYEE_SEQUESTRE' || status === 'EN_COURS' || status === 'TERMINEE';
  });
  protected readonly selectedPaymentOption = computed(
    () =>
      this.paymentOptions.find((option) => option.id === this.selectedMethod()) ??
      this.paymentOptions[0],
  );
  protected readonly clientNameLabel = computed(
    () => this.currentUser()?.name || 'Client Jokko',
  );
  protected readonly reservationNumberLabel = computed(() => {
    const id = this.appointment()?.id ?? '';
    const compact = id.replace(/-/g, '').toUpperCase();
    return `#RDV-${compact.slice(0, 4) || '----'}-${compact.slice(-5) || '-----'}`;
  });
  protected readonly acceptedDateTimeLabel = computed(() => {
    const appointment = this.appointment();
    return appointment ? `${this.formatPaymentDate(appointment)} a ${appointment.timeLabel}` : 'Date a confirmer';
  });
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
    return `+${this.formatAmountValue(difference)} FCFA`;
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
    this.backNavigation.back(this.safeReturnUrl(), fallback);
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
        this.feedback.error(getHttpErrorMessage(error, "Impossible d'ouvrir la discussion avec ce prestataire."));
      },
    });
  }

  protected openAppointmentPage(appointment: AppointmentView): void {
    this.router.navigate(['/appointments', appointment.id], {
      queryParams: { returnUrl: '/appointments' },
    });
  }

  protected goHome(): void {
    this.router.navigate(['/']);
  }

  protected downloadReceipt(appointment: AppointmentView): void {
    const lines = [
      'Jokko - Recu de paiement',
      this.reservationNumberLabel(),
      `Reservation: ${appointment.id}`,
      `Client: ${this.clientNameLabel()}`,
      `Prestataire: ${appointment.doctorName}`,
      `Service: ${appointment.serviceName}`,
      `Date: ${this.formatPaymentDate(appointment)} - ${appointment.timeLabel}`,
      `Adresse: ${appointment.addressLabel}`,
      `Moyen de paiement: ${this.selectedPaymentOption().label}`,
      `Total paye: ${this.amountLabel()}`,
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `recu-jokko-${appointment.id.slice(0, 8)}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  }

  protected shareReceipt(appointment: AppointmentView): void {
    const text = `Paiement confirme sur Jokko: ${appointment.serviceName} avec ${appointment.doctorName}, ${this.amountLabel()}, ${this.formatPaymentDate(appointment)} a ${appointment.timeLabel}.`;
    if (typeof navigator !== 'undefined' && navigator.share) {
      navigator.share({ title: 'Reservation Jokko confirmee', text }).catch(() => undefined);
      return;
    }

    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(text).then(
        () => this.feedback.success('Informations de reservation copiees.'),
        () => this.feedback.info(text),
      );
      return;
    }

    this.feedback.info(text);
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
    const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl')?.trim();
    if (!returnUrl || !returnUrl.startsWith('/') || returnUrl.startsWith('//')) {
      return null;
    }

    return returnUrl;
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

  protected methodAriaLabel(option: PaymentOption): string {
    return `Payer avec ${option.label}`;
  }

  private loadAppointment(reservationId: string): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);

    this.appointmentsService.getAppointmentById(reservationId).subscribe({
      next: (appointment) => {
        this.appointment.set(appointment);
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
