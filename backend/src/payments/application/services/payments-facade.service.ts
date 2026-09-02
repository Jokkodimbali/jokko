import { Inject, Injectable } from '@nestjs/common';
import { RoleUtilisateur } from '@prisma/client';
import type { AuthUser } from '../../../auth/security/auth-user.type';
import {
  CATEGORIES_REPOSITORY_PORT,
  type CategoriesRepositoryPort,
} from '../../../categories/application/ports/categories-repository.port';
import { ReservationsFacade } from '../../../reservations/application/services/reservations-facade.service';
import {
  PROFESSIONALS_REPOSITORY_PORT,
  type ProfessionalsRepositoryPort,
} from '../../../professionals/application/ports/professionals-repository.port';
import { PaymentDomainError } from '../../domain/errors/payment.domain-error';
import { PaymentCommandService } from './payment-command.service';
import { PaymentQueryService } from './payment-query.service';
import { EscrowService } from './escrow.service';
import { WithdrawalService } from './withdrawal.service';
import {
  PaymentMethod,
  PaymentStatus,
  EscrowStatus,
} from '../../domain/value-objects/payment-types.vo';
import {
  PAYMENT_WEBHOOK_EVENT_PORT,
  type PaymentWebhookEventPort,
} from '../ports/payment-webhook-event.port';
import {
  PAYMENT_WEBHOOK_SECURITY_PORT,
  type PaymentWebhookSecurityPort,
} from '../ports/payment-webhook-security.port';
import { DisputesFacade } from '../../../disputes/application/services/disputes-facade.service';
import { WalletQueryService } from './wallet-query.service';
import { PharmacyOrderPaymentService } from './pharmacy-order-payment.service';
import { MaterialOrderPaymentService } from './material-order-payment.service';

export interface PaymentFilters {
  status?: string;
  method?: string;
  escrowStatus?: string;
  limit?: number;
  offset?: number;
}

export type InitiatePaymentForReservationInput = {
  bookingId: string;
  method: PaymentMethod;
  callbackUrl?: string;
  successUrl?: string;
  cancelUrl?: string;
  idempotencyKey?: string;
};

@Injectable()
export class PaymentsFacade {
  constructor(
    private readonly paymentCommandService: PaymentCommandService,
    private readonly paymentQueryService: PaymentQueryService,
    private readonly escrowService: EscrowService,
    private readonly withdrawalService: WithdrawalService,
    private readonly reservationsFacade: ReservationsFacade,
    @Inject(CATEGORIES_REPOSITORY_PORT)
    private readonly categoriesRepository: CategoriesRepositoryPort,
    @Inject(PROFESSIONALS_REPOSITORY_PORT)
    private readonly professionalsRepository: ProfessionalsRepositoryPort,
    @Inject(PAYMENT_WEBHOOK_EVENT_PORT)
    private readonly paymentWebhookEvents: PaymentWebhookEventPort,
    @Inject(PAYMENT_WEBHOOK_SECURITY_PORT)
    private readonly paymentWebhookSecurity: PaymentWebhookSecurityPort,
    private readonly disputesFacade: DisputesFacade,
    private readonly walletQueryService: WalletQueryService,
    private readonly pharmacyOrderPayments: PharmacyOrderPaymentService,
    private readonly materialOrderPayments: MaterialOrderPaymentService,
  ) {}

  async initiatePaymentForReservation(
    requestUser: AuthUser,
    command: InitiatePaymentForReservationInput,
  ) {
    const reservation = await this.reservationsFacade.getReservationById(
      requestUser,
      command.bookingId,
    );
    if (reservation.clientId !== requestUser.sub) {
      throw PaymentDomainError.unauthorizedAccess(requestUser.sub);
    }

    const service = await this.professionalsRepository.getServiceById(
      reservation.serviceId,
    );
    if (!service) {
      throw PaymentDomainError.paymentNotFound(reservation.serviceId);
    }
    const category = await this.categoriesRepository.findById(
      service.categorieId,
    );
    if (!category) {
      throw PaymentDomainError.paymentNotFound(service.categorieId);
    }

    return this.paymentCommandService.initiatePayment({
      bookingId: command.bookingId,
      clientId: requestUser.sub,
      professionalId: reservation.professionnelId,
      amount: Number(reservation.prixConvenu),
      commissionRate: category.tauxCommission,
      method: command.method,
      callbackUrl: command.callbackUrl,
      successUrl: command.successUrl,
      cancelUrl: command.cancelUrl,
      idempotencyKey: command.idempotencyKey,
    });
  }

  async processPaymentWebhook(gatewayReference: string, status: PaymentStatus) {
    return this.paymentCommandService.processPaymentWebhook(
      gatewayReference,
      status,
    );
  }

  async processGatewayWebhook(gatewayReference: string, status: string) {
    if (
      await this.pharmacyOrderPayments.processGatewayStatus(
        gatewayReference,
        status,
      )
    ) {
      return;
    }
    if (
      await this.materialOrderPayments.processGatewayStatus(
        gatewayReference,
        status,
      )
    ) {
      return;
    }
    return this.processPaymentWebhook(
      gatewayReference,
      this.mapGatewayStatusToPaymentStatus(status),
    );
  }

  async processGatewayWebhookEvent(params: {
    gatewayReference?: string;
    invoiceToken?: string;
    status?: string;
    signature?: string;
    timestamp?: string;
    payload: Record<string, unknown>;
  }): Promise<{ received: boolean; processed: boolean; replay: boolean }> {
    const gatewayReference = params.gatewayReference ?? params.invoiceToken;
    if (!gatewayReference || !params.status) {
      return { received: true, processed: false, replay: false };
    }

    const rawPayload = JSON.stringify(params.payload);
    const signatureValid = this.paymentWebhookSecurity.verifySignature({
      rawPayload,
      signature: params.signature,
      timestamp: params.timestamp,
    });

    if (!signatureValid) {
      throw PaymentDomainError.invalidWebhookSignature();
    }

    const eventKey = this.buildWebhookEventKey(gatewayReference, params.status);
    const event = await this.paymentWebhookEvents.recordReceived({
      eventKey,
      provider: this.resolveProviderName(gatewayReference),
      providerReference: gatewayReference,
      providerStatus: params.status,
      signatureValid,
      payload: params.payload,
    });

    if (event.isReplay) {
      return { received: true, processed: false, replay: true };
    }

    try {
      await this.processGatewayWebhook(gatewayReference, params.status);
      await this.paymentWebhookEvents.markProcessed(eventKey);
      return { received: true, processed: true, replay: false };
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : PaymentDomainError.gatewayUnknownError().message;
      await this.paymentWebhookEvents.markFailed(eventKey, message);
      throw error;
    }
  }

  async getClientPaymentHistory(clientId?: string, filters?: PaymentFilters) {
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
    professionalId?: string,
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

  async getPaymentForUser(requestUser: AuthUser, paymentId: string) {
    const payment = await this.getPaymentById(paymentId);
    await this.assertCanAccessPayment(requestUser, payment.id);
    return payment;
  }

  async releaseEscrowForUser(requestUser: AuthUser, paymentId: string) {
    const payment = await this.assertCanReleaseEscrow(requestUser, paymentId);
    await this.assertReservationAllowsEscrowRelease(requestUser, payment);
    return this.escrowService.releaseEscrow(paymentId);
  }

  async disputeEscrowForUser(
    requestUser: AuthUser,
    paymentId: string,
    reason?: string,
  ) {
    await this.assertCanAccessPayment(requestUser, paymentId);
    const payment = await this.escrowService.disputeEscrow(paymentId, reason);
    await this.disputesFacade.openForPayment({
      paymentId: payment.id,
      reservationId: payment.bookingId,
      reporterUserId: requestUser.sub,
      reason: reason?.trim() || 'Litige ouvert depuis le module paiement.',
    });
    return payment;
  }

  async getEscrowStatusForUser(requestUser: AuthUser, paymentId: string) {
    await this.assertCanAccessPayment(requestUser, paymentId);
    return this.escrowService.getEscrowStatus(paymentId);
  }

  async refundPayment(paymentId: string, reason?: string) {
    return this.escrowService.refundPayment(paymentId, reason);
  }

  async getPendingEscrowReleases() {
    return this.escrowService.getPendingEscrowReleases();
  }

  async getAdminStatistics() {
    return this.paymentQueryService.getAdminStatistics();
  }

  async processAutomaticEscrowRelease(paymentId: string) {
    const payment = await this.getPaymentById(paymentId);
    await this.assertReservationAllowsEscrowRelease(
      { sub: 'system', role: RoleUtilisateur.ADMIN, phoneNumber: '' },
      payment,
    );
    return this.escrowService.processAutomaticEscrowRelease(paymentId);
  }

  async requestWithdrawalForUser(
    requestUser: AuthUser,
    params: { amount: number; method: 'WAVE' | 'ORANGE_MONEY' },
  ) {
    const professionalId = await this.getProfessionalProfileId(requestUser);
    return this.withdrawalService.requestWithdrawal({
      professionalId,
      amount: params.amount,
      method: params.method,
    });
  }

  async getProfessionalWithdrawalsForUser(requestUser: AuthUser) {
    const professionalId = await this.getProfessionalProfileId(requestUser);
    return this.withdrawalService.getProfessionalWithdrawals(professionalId);
  }

  async getProfessionalWalletForUser(requestUser: AuthUser) {
    if (!this.isProfessionalWalletRole(requestUser.role)) {
      throw PaymentDomainError.unauthorizedAccess('wallet');
    }

    return this.walletQueryService.getProfessionalWalletByUserId(
      requestUser.sub,
    );
  }

  private async assertCanAccessPayment(
    requestUser: AuthUser,
    paymentId: string,
  ): Promise<void> {
    const payment = await this.paymentQueryService.getPaymentById(paymentId);

    if (requestUser.role === RoleUtilisateur.ADMIN) {
      return;
    }

    if (payment.clientId === requestUser.sub) {
      return;
    }

    if (this.isProfessionalWalletRole(requestUser.role)) {
      const profile = await this.professionalsRepository.findByUserId(
        requestUser.sub,
      );
      if (profile?.id === payment.professionalId) {
        return;
      }
    }

    throw PaymentDomainError.unauthorizedAccess(paymentId);
  }

  private async assertCanReleaseEscrow(
    requestUser: AuthUser,
    paymentId: string,
  ) {
    const payment = await this.paymentQueryService.getPaymentById(paymentId);

    if (requestUser.role === RoleUtilisateur.ADMIN) {
      return payment;
    }

    if (!this.isProfessionalWalletRole(requestUser.role)) {
      throw PaymentDomainError.escrowReleaseProfessionalOnly();
    }

    const profile = await this.professionalsRepository.findByUserId(
      requestUser.sub,
    );
    if (profile?.id !== payment.professionalId) {
      throw PaymentDomainError.unauthorizedAccess(paymentId);
    }

    return payment;
  }

  private async assertReservationAllowsEscrowRelease(
    requestUser: AuthUser,
    payment: Awaited<ReturnType<PaymentQueryService['getPaymentById']>>,
  ): Promise<void> {
    const reservation = await this.reservationsFacade.getReservationById(
      requestUser,
      payment.bookingId,
    );

    if (reservation.statut === 'LITIGE') {
      throw PaymentDomainError.escrowReleaseForbiddenDuringDispute();
    }

    if (reservation.statut !== 'TERMINEE') {
      throw PaymentDomainError.escrowReleaseRequiresCompletedReservation();
    }
  }

  private async getProfessionalProfileId(
    requestUser: AuthUser,
  ): Promise<string> {
    if (!this.isProfessionalWalletRole(requestUser.role)) {
      throw PaymentDomainError.unauthorizedAccess('withdrawals');
    }

    const profile = await this.professionalsRepository.findByUserId(
      requestUser.sub,
    );
    if (!profile) {
      throw PaymentDomainError.unauthorizedAccess('withdrawals');
    }

    return profile.id;
  }

  private isProfessionalWalletRole(role: RoleUtilisateur): boolean {
    return (
      role === RoleUtilisateur.PRESTATAIRE || role === RoleUtilisateur.MEDECIN
    );
  }

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
    return statusMap[status.toUpperCase()];
  }

  private mapToPaymentMethod(method?: string): PaymentMethod | undefined {
    if (!method) return undefined;
    const methodMap: Record<string, PaymentMethod> = {
      WAVE: PaymentMethod.WAVE,
      ORANGE_MONEY: PaymentMethod.ORANGE_MONEY,
      CARD: PaymentMethod.CARD,
    };
    return methodMap[method.toUpperCase()];
  }

  private mapToEscrowStatus(status?: string): EscrowStatus | undefined {
    if (!status) return undefined;
    const statusMap: Record<string, EscrowStatus> = {
      LOCKED: EscrowStatus.LOCKED,
      RELEASED: EscrowStatus.RELEASED,
      DISPUTED: EscrowStatus.DISPUTED,
      REFUNDED: EscrowStatus.REFUNDED,
    };
    return statusMap[status.toUpperCase()];
  }

  private mapGatewayStatusToPaymentStatus(status: string): PaymentStatus {
    const normalizedStatus = status.toLowerCase();
    if (normalizedStatus === 'completed') {
      return PaymentStatus.SUCCESS;
    }

    if (normalizedStatus === 'cancelled') {
      return PaymentStatus.CANCELLED;
    }

    return PaymentStatus.FAILED;
  }

  private buildWebhookEventKey(
    gatewayReference: string,
    status: string,
  ): string {
    return `${gatewayReference}:${status.toLowerCase()}`;
  }

  private resolveProviderName(gatewayReference: string): string {
    const normalizedReference = gatewayReference.toLowerCase();
    if (normalizedReference.includes('wave')) {
      return 'WAVE';
    }

    if (normalizedReference.includes('orange')) {
      return 'ORANGE_MONEY';
    }

    if (normalizedReference.includes('card')) {
      return 'CARTE';
    }

    return 'JOKKO_PAYMENT_GATEWAY';
  }
}
