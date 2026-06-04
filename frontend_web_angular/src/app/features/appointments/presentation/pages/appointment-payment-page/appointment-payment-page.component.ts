import { CommonModule, Location } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ActivatedRoute } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { AppFeedbackService } from '../../../../../core/feedback/app-feedback.service';
import { getHttpErrorMessage } from '../../../../../core/http/api-response.utils';
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
  private readonly location = inject(Location);
  private readonly appointmentsService = inject(AppointmentsService);
  private readonly feedback = inject(AppFeedbackService);

  protected readonly appointment = signal<AppointmentView | null>(null);
  protected readonly selectedMethod = signal<PaymentMethod>('WAVE');
  protected readonly isLoading = signal(true);
  protected readonly isPaying = signal(false);
  protected readonly isCancelling = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  protected readonly paymentOptions: PaymentOption[] = [
    { id: 'WAVE', label: 'Wave', logoUrl: '/wave.png' },
    { id: 'ORANGE_MONEY', label: 'Orange Money', logoUrl: '/Orange-Money-logo.png' },
    { id: 'CARD', label: 'Carte Bancaire', logoUrl: '/logo vissa.avif' },
  ];

  protected readonly amountLabel = computed(() =>
    this.formatAmount(this.appointment()?.agreedPrice ?? 0),
  );

  protected readonly amountValueLabel = computed(() =>
    new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(
      this.appointment()?.agreedPrice ?? 0,
    ),
  );

  ngOnInit(): void {
    const reservationId = this.route.snapshot.paramMap.get('id');

    if (!reservationId) {
      this.router.navigate(['/appointments']);
      return;
    }

    this.loadAppointment(reservationId);
  }

  protected goBack(): void {
    this.location.back();
  }

  protected selectMethod(method: PaymentMethod): void {
    this.selectedMethod.set(method);
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

    this.appointmentsService.initiatePayment(appointment.id, this.selectedMethod()).subscribe({
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
            next: () => this.router.navigate(['/appointments', appointment.id]),
            error: () => this.router.navigate(['/appointments', appointment.id]),
          });
          return;
        }

        this.router.navigate(['/appointments', appointment.id]);
      },
      error: (error) => {
        this.errorMessage.set(getHttpErrorMessage(error, "Impossible d'initialiser le paiement."));
        this.isPaying.set(false);
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
    return `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(value || 0)} FCFA`;
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
