import { ConflictException, Inject, Injectable } from '@nestjs/common';
import { EscrowStatus, StatutPaiement } from '@prisma/client';
import { OnEvent } from '@nestjs/event-emitter';
import { randomUUID } from 'node:crypto';
import { PaymentMethod } from '../../domain/value-objects/payment-types.vo';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  PAYMENT_GATEWAY_PORT,
  type PaymentGateway,
} from '../ports/payment-gateway.port';

/** Performs the external client refund before a dispute can be finalised. */
@Injectable()
export class DisputeRefundService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(PAYMENT_GATEWAY_PORT)
    private readonly paymentGateway: PaymentGateway,
  ) {}

  async refundForDispute(input: {
    disputeId: string;
    paymentId: string;
    amount: number;
    reason: string;
  }): Promise<void> {
    if (input.amount <= 0) return;

    await this.processRefund({
      paymentId: input.paymentId,
      amount: input.amount,
      reason: input.reason,
      idempotencyKey: `dispute-refund:${input.disputeId}`,
      disputeId: input.disputeId,
    });
  }

  async refundForCancellation(input: {
    reservationId: string;
    reason: string;
    paymentRequired?: boolean;
  }): Promise<void> {
    const payment = await this.prisma.paiement.findUnique({
      where: { reservationId: input.reservationId },
      select: { id: true, montant: true, statut: true },
    });
    if (!payment) {
      if (input.paymentRequired)
        throw new ConflictException('PAYMENTS_CANCELLATION_PAYMENT_MISSING');
      return;
    }
    if (payment.statut === StatutPaiement.EN_ATTENTE) {
      throw new ConflictException('PAYMENTS_CANCELLATION_PAYMENT_PENDING');
    }
    if (payment.statut === StatutPaiement.ECHEC) {
      if (input.paymentRequired)
        throw new ConflictException('PAYMENTS_CANCELLATION_PAYMENT_MISSING');
      return;
    }
    if (
      payment.statut !== StatutPaiement.SUCCES &&
      payment.statut !== StatutPaiement.REMBOURSE
    ) {
      throw new ConflictException('PAYMENTS_CANCELLATION_REFUND_NOT_AVAILABLE');
    }
    if (Number(payment.montant) <= 0) {
      throw new ConflictException(
        'PAYMENTS_CANCELLATION_REFUND_INVALID_AMOUNT',
      );
    }

    await this.processRefund({
      paymentId: payment.id,
      amount: Number(payment.montant),
      reason: input.reason,
      idempotencyKey: `reservation-cancellation-refund:${input.reservationId}`,
      reservationId: input.reservationId,
      markPaymentRefunded: true,
    });
  }

  private async processRefund(input: {
    paymentId: string;
    amount: number;
    reason: string;
    idempotencyKey: string;
    disputeId?: string;
    reservationId?: string;
    markPaymentRefunded?: boolean;
  }): Promise<void> {
    const refundKey = input.disputeId
      ? { litigeId: input.disputeId }
      : { reservationId: input.reservationId! };
    const existing = await this.prisma.remboursementPaiement.findUnique({
      where: refundKey,
    });
    if (existing?.statut === 'TERMINE') {
      if (input.markPaymentRefunded) {
        await this.markCancellationPaymentRefunded(
          input.paymentId,
          input.reason,
        );
      }
      return;
    }
    if (existing?.statut === 'EN_COURS') {
      throw new ConflictException('PAYMENTS_REFUND_IN_PROGRESS');
    }

    const payment = await this.prisma.paiement.findUnique({
      where: { id: input.paymentId },
      select: {
        gatewayReference: true,
        referenceFournisseur: true,
        escrowStatus: true,
        methode: true,
      },
    });
    if (!payment?.gatewayReference && !payment?.referenceFournisseur) {
      throw new ConflictException('PAYMENTS_REFUND_REFERENCE_MISSING');
    }
    if (!['LOCKED', 'DISPUTED'].includes(payment.escrowStatus)) {
      throw new ConflictException('PAYMENTS_REFUND_ESCROW_NOT_AVAILABLE');
    }

    const refund = existing
      ? await this.prisma.remboursementPaiement.update({
          where: { id: existing.id },
          data: {
            statut: 'EN_COURS',
            erreur: null,
            montant: input.amount,
            motif: input.reason,
          },
        })
      : await this.prisma.remboursementPaiement.create({
          data: {
            id: randomUUID(),
            paiementId: input.paymentId,
            ...refundKey,
            montant: input.amount,
            motif: input.reason,
            cleIdempotence: input.idempotencyKey,
          },
        });

    try {
      const response = await this.paymentGateway.processRefund({
        gatewayReference:
          payment.gatewayReference ?? payment.referenceFournisseur!,
        amount: input.amount,
        reason: input.reason,
        idempotencyKey: input.idempotencyKey,
        ...(payment.methode
          ? {
              method:
                payment.methode === 'ORANGE_MONEY'
                  ? PaymentMethod.ORANGE_MONEY
                  : payment.methode === 'CARTE'
                    ? PaymentMethod.CARD
                    : PaymentMethod.WAVE,
            }
          : {}),
      });
      if (!response.success) {
        throw new Error(response.error || 'PAYMENTS_REFUND_PROVIDER_REJECTED');
      }
      await this.prisma.remboursementPaiement.update({
        where: { id: refund.id },
        data: {
          statut: 'TERMINE',
          referenceFournisseur: response.gatewayReference ?? null,
          termineLe: new Date(),
        },
      });
    } catch (error) {
      await this.prisma.remboursementPaiement.update({
        where: { id: refund.id },
        data: {
          statut: 'ECHEC',
          erreur:
            error instanceof Error ? error.message : 'PAYMENTS_REFUND_FAILED',
        },
      });
      throw error;
    }
    if (input.markPaymentRefunded) {
      await this.markCancellationPaymentRefunded(input.paymentId, input.reason);
    }
  }

  private async markCancellationPaymentRefunded(
    paymentId: string,
    reason: string,
  ): Promise<void> {
    const result = await this.prisma.paiement.updateMany({
      where: {
        id: paymentId,
        statut: StatutPaiement.SUCCES,
        escrowStatus: EscrowStatus.LOCKED,
      },
      data: {
        statut: StatutPaiement.REMBOURSE,
        escrowStatus: EscrowStatus.REFUNDED,
        raisonRemboursement: reason,
      },
    });
    if (result.count > 0) return;
    const payment = await this.prisma.paiement.findUnique({
      where: { id: paymentId },
      select: { statut: true, escrowStatus: true },
    });
    if (
      payment?.statut !== StatutPaiement.REMBOURSE ||
      payment.escrowStatus !== EscrowStatus.REFUNDED
    ) {
      throw new ConflictException(
        'PAYMENTS_CANCELLATION_REFUND_STATUS_NOT_UPDATED',
      );
    }
  }

  @OnEvent('disputes.refund.requested')
  async handleRefundRequested(input: {
    disputeId: string;
    paymentId: string;
    amount: number;
    reason: string;
  }): Promise<void> {
    await this.refundForDispute(input);
  }

  @OnEvent('reservations.cancellation.refund.requested')
  async handleCancellationRefundRequested(input: {
    reservationId: string;
    reason: string;
    paymentRequired?: boolean;
  }): Promise<void> {
    await this.refundForCancellation(input);
  }
}
