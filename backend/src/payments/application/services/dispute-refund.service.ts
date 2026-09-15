import { ConflictException, Inject, Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { randomUUID } from 'node:crypto';
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

    const payment = await this.prisma.paiement.findUnique({
      where: { id: input.paymentId },
      select: { gatewayReference: true, referenceFournisseur: true, escrowStatus: true },
    });
    if (!payment?.gatewayReference && !payment?.referenceFournisseur) {
      throw new ConflictException('PAYMENTS_REFUND_REFERENCE_MISSING');
    }
    if (!['LOCKED', 'DISPUTED'].includes(payment.escrowStatus)) {
      throw new ConflictException('PAYMENTS_REFUND_ESCROW_NOT_AVAILABLE');
    }

    const idempotencyKey = `dispute-refund:${input.disputeId}`;
    const existing = await this.prisma.remboursementPaiement.findUnique({
      where: { litigeId: input.disputeId },
    });
    if (existing?.statut === 'TERMINE') return;
    if (existing?.statut === 'EN_COURS') {
      throw new ConflictException('PAYMENTS_REFUND_IN_PROGRESS');
    }

    const refund = existing
      ? await this.prisma.remboursementPaiement.update({
          where: { id: existing.id },
          data: { statut: 'EN_COURS', erreur: null, montant: input.amount, motif: input.reason },
        })
      : await this.prisma.remboursementPaiement.create({
          data: {
            id: randomUUID(),
            paiementId: input.paymentId,
            litigeId: input.disputeId,
            montant: input.amount,
            motif: input.reason,
            cleIdempotence: idempotencyKey,
          },
        });

    try {
      const response = await this.paymentGateway.processRefund({
        gatewayReference: payment.gatewayReference ?? payment.referenceFournisseur!,
        amount: input.amount,
        reason: input.reason,
        idempotencyKey,
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
          erreur: error instanceof Error ? error.message : 'PAYMENTS_REFUND_FAILED',
        },
      });
      throw error;
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
}
