import { Injectable } from '@nestjs/common';
import {
  EscrowStatus as PrismaEscrowStatus,
  StatutPaiement,
  StatutRetrait,
  TypeTransactionPortefeuille,
} from '@prisma/client';
import { PAYMENT_NOTIFICATION_MESSAGES } from '../../../core/messages/payment-notification.messages';
import { PrismaService } from '../../../prisma/prisma.service';
import { type WalletLedgerPort } from '../../application/ports/wallet-ledger.port';
import { type Payment } from '../../domain/entities/payment.entity';

@Injectable()
export class WalletLedgerRepository implements WalletLedgerPort {
  constructor(private readonly prisma: PrismaService) {}

  async getAvailableBalance(professionalId: string): Promise<number> {
    const profile = await this.prisma.profilProfessionnel.findUnique({
      where: { id: professionalId },
      select: { soldePortefeuille: true },
    });

    return profile ? Number(profile.soldePortefeuille) : 0;
  }

  async creditReleasedEscrow(payment: Payment): Promise<void> {
    const reference = `wallet:release:${payment.id}`;

    await this.prisma.$transaction(async (tx) => {
      const existing = await tx.transactionPortefeuille.findUnique({
        where: { reference },
      });

      if (existing) {
        return;
      }

      await tx.paiement.update({
        where: { id: payment.id },
        data: {
          statut: StatutPaiement.SUCCES,
          escrowStatus: PrismaEscrowStatus.RELEASED,
          escrowReleasedAt: payment.escrowReleasedAt,
          misAJourLe: new Date(),
        },
      });

      const updatedProfile = await tx.profilProfessionnel.update({
        where: { id: payment.professionalId },
        data: {
          soldePortefeuille: {
            increment: payment.netAmount.getValue(),
          },
        },
      });

      await tx.transactionPortefeuille.create({
        data: {
          profilProfessionnelId: payment.professionalId,
          paiementId: payment.id,
          type: TypeTransactionPortefeuille.CREDIT_ESCROW,
          montant: payment.netAmount.getValue(),
          soldeApres: updatedProfile.soldePortefeuille,
          description:
            PAYMENT_NOTIFICATION_MESSAGES.WALLET_ESCROW_RELEASED_DESCRIPTION,
          reference,
        },
      });
    });
  }

  async debitWithdrawal(params: {
    professionalId: string;
    amount: number;
    withdrawalId: string;
    processedAt: Date;
    gatewayReference: string;
  }): Promise<void> {
    const reference = `wallet:withdrawal:${params.withdrawalId}`;

    await this.prisma.$transaction(async (tx) => {
      const existing = await tx.transactionPortefeuille.findUnique({
        where: { reference },
      });

      if (existing) {
        return;
      }

      await tx.demandeRetrait.update({
        where: { id: params.withdrawalId },
        data: {
          statut: StatutRetrait.TERMINE,
          traiteLe: params.processedAt,
          referenceFournisseur: params.gatewayReference,
        },
      });

      const updatedProfile = await tx.profilProfessionnel.update({
        where: { id: params.professionalId },
        data: {
          soldePortefeuille: {
            decrement: params.amount,
          },
        },
      });

      await tx.transactionPortefeuille.create({
        data: {
          profilProfessionnelId: params.professionalId,
          type: TypeTransactionPortefeuille.DEBIT_RETRAIT,
          montant: -params.amount,
          soldeApres: updatedProfile.soldePortefeuille,
          description:
            PAYMENT_NOTIFICATION_MESSAGES.WALLET_WITHDRAWAL_DEBIT_DESCRIPTION,
          reference,
        },
      });
    });
  }
}
