import { Injectable } from '@nestjs/common';
import {
  EscrowStatus,
  StatutPaiement,
  StatutReservation,
  StatutRetrait,
  TypeTransactionPortefeuille,
} from '@prisma/client';
import { PaymentDomainError } from '../../domain/errors/payment.domain-error';
import { PrismaService } from '../../../prisma/prisma.service';

type WalletTransactionDirection = 'IN' | 'OUT';

export type ProfessionalWalletView = {
  professionalId: string;
  availableBalance: number;
  monthlyRevenue: {
    amount: number;
    changePercent: number;
    consultationCount: number;
    teleconsultationCount: number;
    refundedCancellationCount: number;
  };
  transactions: Array<{
    id: string;
    title: string;
    date: Date;
    amount: number;
    direction: WalletTransactionDirection;
    type: TypeTransactionPortefeuille | 'RETRAIT_EN_ATTENTE';
    status: 'TERMINE' | 'EN_ATTENTE';
    reference: string;
  }>;
  pendingEscrow: Array<{
    paymentId: string;
    reservationId: string;
    serviceName: string;
    clientName: string;
    date: Date;
    amount: number;
    netAmount: number;
    reservationStatus: StatutReservation;
    canRequestRelease: boolean;
  }>;
};

@Injectable()
export class WalletQueryService {
  constructor(private readonly prisma: PrismaService) {}

  async getProfessionalWalletByUserId(
    userId: string,
  ): Promise<ProfessionalWalletView> {
    const profile = await this.prisma.profilProfessionnel.findUnique({
      where: { utilisateurId: userId },
      select: {
        id: true,
        soldePortefeuille: true,
      },
    });

    if (!profile) {
      throw PaymentDomainError.unauthorizedAccess('wallet');
    }

    const now = new Date();
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const nextMonthStart = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const previousMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

    const [
      currentMonthPayments,
      previousMonthPayments,
      refundedPayments,
      ledgerTransactions,
      pendingWithdrawals,
      lockedEscrowPayments,
    ] = await this.prisma.$transaction([
      this.prisma.paiement.findMany({
        where: {
          professionalId: profile.id,
          statut: StatutPaiement.SUCCES,
          escrowStatus: EscrowStatus.RELEASED,
          escrowReleasedAt: {
            gte: currentMonthStart,
            lt: nextMonthStart,
          },
        },
        include: {
          reservation: {
            include: {
              service: {
                include: { categorie: true },
              },
            },
          },
        },
      }),
      this.prisma.paiement.findMany({
        where: {
          professionalId: profile.id,
          statut: StatutPaiement.SUCCES,
          escrowStatus: EscrowStatus.RELEASED,
          escrowReleasedAt: {
            gte: previousMonthStart,
            lt: currentMonthStart,
          },
        },
        select: { montantNet: true },
      }),
      this.prisma.paiement.findMany({
        where: {
          professionalId: profile.id,
          statut: StatutPaiement.REMBOURSE,
          misAJourLe: {
            gte: currentMonthStart,
            lt: nextMonthStart,
          },
        },
        select: { id: true },
      }),
      this.prisma.transactionPortefeuille.findMany({
        where: { profilProfessionnelId: profile.id },
        orderBy: { creeLe: 'desc' },
        take: 20,
        include: {
          paiement: {
            include: {
              reservation: {
                include: {
                  client: true,
                  service: true,
                },
              },
            },
          },
        },
      }),
      this.prisma.demandeRetrait.findMany({
        where: {
          profilProfessionnelId: profile.id,
          statut: StatutRetrait.EN_ATTENTE,
        },
        orderBy: { demandeLe: 'desc' },
        take: 5,
      }),
      this.prisma.paiement.findMany({
        where: {
          professionalId: profile.id,
          statut: StatutPaiement.SUCCES,
          escrowStatus: EscrowStatus.LOCKED,
        },
        orderBy: { creeLe: 'desc' },
        take: 20,
        include: {
          reservation: {
            include: {
              client: true,
              service: true,
            },
          },
        },
      }),
    ]);

    const withdrawalIds = ledgerTransactions
      .filter((transaction) => transaction.type === TypeTransactionPortefeuille.DEBIT_RETRAIT)
      .map((transaction) => transaction.reference.replace('wallet:withdrawal:', ''))
      .filter((reference) => reference.length > 0);

    const withdrawalsById =
      withdrawalIds.length > 0
        ? new Map(
            (
              await this.prisma.demandeRetrait.findMany({
                where: { id: { in: withdrawalIds } },
              })
            ).map((withdrawal) => [withdrawal.id, withdrawal]),
          )
        : new Map();

    const currentRevenue = currentMonthPayments.reduce(
      (total, payment) => total + Number(payment.montantNet),
      0,
    );
    const previousRevenue = previousMonthPayments.reduce(
      (total, payment) => total + Number(payment.montantNet),
      0,
    );
    const teleconsultationCount = currentMonthPayments.filter((payment) =>
      this.isTeleconsultation(payment.reservation.service.nom, payment.reservation.service.categorie.nom),
    ).length;

    const completedTransactions = ledgerTransactions.map((transaction) => {
      const amount = Number(transaction.montant);
      const withdrawalId = transaction.reference.replace('wallet:withdrawal:', '');
      const withdrawal = withdrawalsById.get(withdrawalId);
      return {
        id: transaction.id,
        title: this.resolveTransactionTitle(
          transaction.type,
          transaction.paiement?.reservation.service.nom,
          transaction.paiement?.reservation.client.nom,
          withdrawal?.methode,
        ),
        date: transaction.creeLe,
        amount,
        direction: (amount >= 0 ? 'IN' : 'OUT') as WalletTransactionDirection,
        type: transaction.type,
        status: 'TERMINE' as const,
        reference: transaction.reference,
      };
    });

    const pendingWithdrawalTransactions = pendingWithdrawals.map((withdrawal) => ({
      id: withdrawal.id,
      title: `Retrait ${this.formatWithdrawalMethod(withdrawal.methode)}`,
      date: withdrawal.demandeLe,
      amount: -Number(withdrawal.montant),
      direction: 'OUT' as const,
      type: 'RETRAIT_EN_ATTENTE' as const,
      status: 'EN_ATTENTE' as const,
      reference: `withdrawal:pending:${withdrawal.id}`,
    }));

    const pendingEscrow = lockedEscrowPayments.map((payment) => ({
      paymentId: payment.id,
      reservationId: payment.reservationId,
      serviceName: payment.reservation.service.nom,
      clientName: payment.reservation.client.nom,
      date: payment.reservation.dateHeure,
      amount: Number(payment.montant),
      netAmount: Number(payment.montantNet),
      reservationStatus: payment.reservation.statut,
      canRequestRelease: payment.reservation.statut === StatutReservation.TERMINEE,
    }));

    return {
      professionalId: profile.id,
      availableBalance: Number(profile.soldePortefeuille),
      monthlyRevenue: {
        amount: currentRevenue,
        changePercent: this.calculateChangePercent(currentRevenue, previousRevenue),
        consultationCount: currentMonthPayments.length - teleconsultationCount,
        teleconsultationCount,
        refundedCancellationCount: refundedPayments.length,
      },
      transactions: [...pendingWithdrawalTransactions, ...completedTransactions]
        .sort((left, right) => right.date.getTime() - left.date.getTime())
        .slice(0, 20),
      pendingEscrow,
    };
  }

  private calculateChangePercent(current: number, previous: number): number {
    if (previous === 0) return current > 0 ? 100 : 0;
    return Math.round(((current - previous) / previous) * 100);
  }

  private isTeleconsultation(serviceName: string, categoryName: string): boolean {
    const normalized = `${serviceName} ${categoryName}`
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
    return normalized.includes('tele');
  }

  private resolveTransactionTitle(
    type: TypeTransactionPortefeuille,
    serviceName?: string,
    clientName?: string,
    withdrawalMethod?: string,
  ): string {
    if (type === TypeTransactionPortefeuille.DEBIT_RETRAIT) {
      return `Retrait ${this.formatWithdrawalMethod(withdrawalMethod)}`;
    }

    if (type === TypeTransactionPortefeuille.REMBOURSEMENT) {
      return `Annulation remboursee${clientName ? ` - ${clientName}` : ''}`;
    }

    return `${serviceName ?? 'Consultation'}${clientName ? ` - ${clientName}` : ''}`;
  }

  private formatWithdrawalMethod(method?: string): string {
    if (method === 'ORANGE_MONEY') return 'Orange Money';
    if (method === 'WAVE') return 'Wave';
    return 'mobile money';
  }
}
