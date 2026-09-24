import { CommonModule } from '@angular/common';
import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { catchError, forkJoin, of } from 'rxjs';
import { AppFeedbackService } from '../../../../../core/feedback/app-feedback.service';
import {
  AdminEscrowProcessResult,
  AdminPayment,
  AdminPaymentStatistics,
  AdminPendingEscrowPayment,
} from '../../../data-access/admin.models';
import { AdminPaymentsService } from '../../../data-access/admin-payments.service';

@Component({
  selector: 'app-admin-payments-panel',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideAngularModule],
  templateUrl: './admin-payments-panel.component.html',
  styleUrl: './admin-payments-panel.component.scss',
})
export class AdminPaymentsPanelComponent implements OnInit {
  private readonly paymentsService = inject(AdminPaymentsService);
  private readonly feedback = inject(AppFeedbackService);
  private readonly pageSize = 12;
  protected readonly payments = signal<AdminPayment[]>([]);
  protected readonly totalPayments = signal(0);
  protected readonly page = signal(1);
  protected readonly statistics = signal<AdminPaymentStatistics | null>(null);
  protected readonly escrow = signal<AdminPendingEscrowPayment[]>([]);
  protected readonly escrowResult = signal<AdminEscrowProcessResult | null>(null);
  protected readonly selected = signal<AdminPayment | null>(null);
  protected readonly isLoading = signal(false);
  protected readonly action = signal<'refund' | 'escrow' | null>(null);
  protected status = '';
  protected method = '';
  protected refundReason = '';
  protected refundCandidate: AdminPayment | null = null;
  protected confirmEscrow = false;

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    this.isLoading.set(true);
    forkJoin({
      report: this.paymentsService.list({
        status: this.status || undefined,
        method: this.method || undefined,
        limit: this.pageSize,
        offset: (this.page() - 1) * this.pageSize,
      }),
      statistics: this.paymentsService.statistics(),
      escrow: this.paymentsService.pendingEscrow(),
    })
      .pipe(
        catchError(() => {
          this.feedback.error('Impossible de charger les paiements admin pour le moment.');
          return of(null);
        }),
      )
      .subscribe((result) => {
        if (result) {
          this.payments.set(result.report.clientPayments.payments);
          this.totalPayments.set(result.report.clientPayments.total);
          this.statistics.set(result.statistics);
          this.escrow.set(result.escrow);
        }
        this.isLoading.set(false);
      });
  }

  protected applyFilters(): void {
    this.page.set(1);
    this.load();
  }

  protected clearFilters(): void {
    this.status = '';
    this.method = '';
    this.page.set(1);
    this.load();
  }

  protected previousPage(): void {
    if (this.page() <= 1 || this.isLoading()) return;
    this.page.update((page) => page - 1);
    this.load();
  }

  protected nextPage(): void {
    if (this.page() >= this.pageCount() || this.isLoading()) return;
    this.page.update((page) => page + 1);
    this.load();
  }

  protected pageCount(): number {
    return Math.max(1, Math.ceil(this.totalPayments() / this.pageSize));
  }

  protected pageStart(): number {
    if (this.totalPayments() === 0) return 0;
    return (this.page() - 1) * this.pageSize + 1;
  }

  protected pageEnd(): number {
    return Math.min(this.page() * this.pageSize, this.totalPayments());
  }

  protected open(paymentId: string): void {
    this.paymentsService
      .get(paymentId)
      .pipe(
        catchError(() => {
          this.feedback.error('Impossible de charger le detail de ce paiement.');
          return of(null);
        }),
      )
      .subscribe((payment) => this.selected.set(payment));
  }

  protected openRefund(payment: AdminPayment): void {
    this.refundCandidate = payment;
    this.refundReason = '';
  }

  protected confirmRefund(): void {
    const payment = this.refundCandidate;
    if (!payment || !this.refundReason.trim()) return;
    this.action.set('refund');
    this.paymentsService
      .refund(payment.id, this.refundReason.trim())
      .pipe(
        catchError(() => {
          this.feedback.error('Impossible de rembourser ce paiement.');
          return of(null);
        }),
      )
      .subscribe((result) => {
        if (result) {
          this.feedback.success('Paiement rembourse avec succes.');
          this.selected.set(result.payment);
          this.payments.update((payments) =>
            payments.map((item) =>
              item.id === result.payment.id ? { ...item, ...result.payment } : item,
            ),
          );
          this.load();
        }
        this.refundCandidate = null;
        this.action.set(null);
      });
  }

  protected processEscrow(): void {
    this.action.set('escrow');
    this.paymentsService
      .processPendingEscrow()
      .pipe(
        catchError(() => {
          this.feedback.error('Impossible de traiter les versements en attente.');
          return of(null);
        }),
      )
      .subscribe((result) => {
        if (result) {
          this.feedback.success('Versements en attente traites.');
          this.escrowResult.set(result);
          this.load();
        }
        this.confirmEscrow = false;
        this.action.set(null);
      });
  }

  protected canRefund(payment: AdminPayment): boolean {
    return payment.status === 'SUCCESS' && payment.escrowStatus !== 'REFUNDED';
  }

  protected statusLabel(status: string): string {
    return {
      SUCCESS: 'Succes',
      PENDING: 'En attente',
      PROCESSING: 'En traitement',
      FAILED: 'Echec',
      CANCELLED: 'Annule',
      REFUNDED: 'Rembourse',
    }[status] ?? status;
  }

  protected statusTone(status: string): string {
    if (status === 'SUCCESS') return 'success';
    if (status === 'PENDING' || status === 'PROCESSING') return 'warning';
    if (status === 'FAILED' || status === 'CANCELLED') return 'danger';
    if (status === 'REFUNDED') return 'info';
    return 'neutral';
  }

  protected escrowLabel(status?: string): string {
    return {
      LOCKED: 'Bloque',
      RELEASED: 'Libere',
      DISPUTED: 'En litige',
      REFUNDED: 'Rembourse',
    }[status ?? ''] ?? 'Non defini';
  }

  protected escrowTone(status?: string): string {
    if (status === 'RELEASED') return 'success';
    if (status === 'LOCKED') return 'warning';
    if (status === 'DISPUTED') return 'danger';
    if (status === 'REFUNDED') return 'info';
    return 'neutral';
  }

  protected methodLabel(method: string): string {
    return {
      WAVE: 'Wave',
      ORANGE_MONEY: 'Orange Money',
      CARD: 'Carte bancaire',
    }[method] ?? method;
  }

  protected money(value: number): string {
    return `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(value)} FCFA`;
  }

  protected date(value?: string | Date): string {
    return value
      ? new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeStyle: 'short' }).format(
          new Date(value),
        )
      : 'Date non exposee';
  }
}
