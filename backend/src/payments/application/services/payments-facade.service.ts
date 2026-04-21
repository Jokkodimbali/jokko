import { Injectable } from '@nestjs/common';
import { PaymentCommandService } from './payment-command.service';
import { PaymentQueryService } from './payment-query.service';
import { EscrowService } from './escrow.service';
import { WithdrawalService } from './withdrawal.service';
import {
  PaymentMethod,
  PaymentStatus,
  EscrowStatus,
} from '../../domain/value-objects/payment-types.vo';

export interface PaymentFilters {
  status?: string;
  method?: string;
  escrowStatus?: string;
  limit?: number;
  offset?: number;
}

@Injectable()
export class PaymentsFacade {
  constructor(
    private readonly paymentCommandService: PaymentCommandService,
    private readonly paymentQueryService: PaymentQueryService,
    private readonly escrowService: EscrowService,
    private readonly withdrawalService: WithdrawalService,
  ) {}

  private mapToPaymentStatus(status?: string): PaymentStatus | undefined {
    if (!status) return undefined;
    const statusMap: Record<string, PaymentStatus> = {
      PENDING: PaymentStatus.PENDING,
      PROCESSING: PaymentStatus.PROCESSING,
      SUCCESS: PaymentStatus.SUCCESS,
      FAILED: PaymentStatus.FAILED,
      CANCELLED: PaymentStatus.CANCELLED,
      REFUNDED: PaymentStatus.REFUNDED,
    };
    return statusMap[status.toUpperCase()] || undefined;
  }

  private mapToPaymentMethod(method?: string): PaymentMethod | undefined {
    if (!method) return undefined;
    const methodMap: Record<string, PaymentMethod> = {
      WAVE: PaymentMethod.WAVE,
      ORANGE_MONEY: PaymentMethod.ORANGE_MONEY,
      CARD: PaymentMethod.CARD,
    };
    return methodMap[method.toUpperCase()] || undefined;
  }

  private mapToEscrowStatus(status?: string): EscrowStatus | undefined {
    if (!status) return undefined;
    const statusMap: Record<string, EscrowStatus> = {
      LOCKED: EscrowStatus.LOCKED,
      RELEASED: EscrowStatus.RELEASED,
      DISPUTED: EscrowStatus.DISPUTED,
      REFUNDED: EscrowStatus.REFUNDED,
    };
    return statusMap[status.toUpperCase()] || undefined;
  }

  // Commands
  async initiatePayment(command: {
    bookingId: string;
    clientId: string;
    professionalId: string;
    amount: number;
    method: PaymentMethod;
    callbackUrl?: string;
    successUrl?: string;
    cancelUrl?: string;
  }) {
    return this.paymentCommandService.initiatePayment(command);
  }

  async processPaymentWebhook(gatewayReference: string, status: PaymentStatus) {
    return this.paymentCommandService.processPaymentWebhook(
      gatewayReference,
      status,
    );
  }

  // Queries
  async getClientPaymentHistory(clientId: string, filters?: PaymentFilters) {
    const mappedFilters = filters
      ? {
          status: this.mapToPaymentStatus(filters.status),
          method: this.mapToPaymentMethod(filters.method),
          limit: filters.limit,
          offset: filters.offset,
        }
      : undefined;
    return this.paymentQueryService.getClientPaymentHistory(
      clientId,
      mappedFilters,
    );
  }

  async getProfessionalPaymentHistory(
    professionalId: string,
    filters?: PaymentFilters,
  ) {
    const mappedFilters = filters
      ? {
          status: this.mapToPaymentStatus(filters.status),
          escrowStatus: this.mapToEscrowStatus(filters.escrowStatus),
          limit: filters.limit,
          offset: filters.offset,
        }
      : undefined;
    return this.paymentQueryService.getProfessionalPaymentHistory(
      professionalId,
      mappedFilters,
    );
  }

  async getPaymentById(paymentId: string) {
    return this.paymentQueryService.getPaymentById(paymentId);
  }

  // Escrow
  async releaseEscrow(paymentId: string) {
    return this.escrowService.releaseEscrow(paymentId);
  }

  async disputeEscrow(paymentId: string, reason?: string) {
    return this.escrowService.disputeEscrow(paymentId, reason);
  }

  async refundPayment(paymentId: string, reason?: string) {
    return this.escrowService.refundPayment(paymentId, reason);
  }

  async getPendingEscrowReleases() {
    return this.escrowService.getPendingEscrowReleases();
  }

  async getEscrowStatus(paymentId: string) {
    return this.escrowService.getEscrowStatus(paymentId);
  }

  async processAutomaticEscrowRelease(paymentId: string) {
    return this.escrowService.processAutomaticEscrowRelease(paymentId);
  }

  // Withdrawals
  async requestWithdrawal(params: {
    professionalId: string;
    amount: number;
    method: 'WAVE' | 'ORANGE_MONEY';
    walletBalance: number;
  }) {
    return this.withdrawalService.requestWithdrawal(params);
  }

  async getProfessionalWithdrawals(professionalId: string) {
    return this.withdrawalService.getProfessionalWithdrawals(professionalId);
  }
}
