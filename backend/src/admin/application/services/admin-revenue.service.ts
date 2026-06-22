import { Injectable } from '@nestjs/common';
import { MethodePaiement, StatutPaiement } from '@prisma/client';
import { appHttpException } from '../../../core/http/app-http.exception';
import { PrismaService } from '../../../prisma/prisma.service';
import type { AuthUser } from '../../../auth/security/auth-user.type';

type AdminRevenuePeriod = '7d' | '30d' | '90d' | '12m';
type PaymentRow = Awaited<
  ReturnType<AdminRevenueService['findPayments']>
>[number];

@Injectable()
export class AdminRevenueService {
  constructor(private readonly prisma: PrismaService) {}

  async getRevenue(requestUser: AuthUser, period: AdminRevenuePeriod = '12m') {
    if (requestUser.role !== 'ADMIN') {
      throw appHttpException('USERS_ADMIN_FORBIDDEN_ROLE');
    }

    const now = new Date();
    const buckets = this.buildBuckets(period, now);
    const payments = await this.findPayments(buckets[0].start, now);
    const successfulPayments = payments.filter(
      (payment) => payment.statut === StatutPaiement.SUCCES,
    );
    const refundedPayments = payments.filter(
      (payment) => payment.statut === StatutPaiement.REMBOURSE,
    );

    return {
      period,
      generatedAt: now,
      totals: this.buildTotals(payments, successfulPayments, refundedPayments),
      series: this.buildSeries(buckets, successfulPayments, refundedPayments),
      methods: this.buildMethodDistribution(successfulPayments),
      topProviders: this.buildTopProviders(successfulPayments),
      recentPayments: payments
        .slice()
        .sort((a, b) => b.creeLe.getTime() - a.creeLe.getTime())
        .slice(0, 8)
        .map((payment) => ({
          id: payment.id,
          reference:
            payment.referenceTransaction ??
            payment.referenceFournisseur ??
            payment.gatewayReference,
          method: payment.methode,
          status: payment.statut,
          amount: this.toNumber(payment.montant),
          net: this.toNumber(payment.montantNet),
          commission: this.toNumber(payment.montantCommission),
          createdAt: payment.creeLe,
          clientName: payment.client.nom,
          professionalName: payment.professionnel.utilisateur.nom,
          serviceName: payment.reservation.service.nom,
        })),
    };
  }

  private findPayments(startDate: Date, endDate: Date) {
    return this.prisma.paiement.findMany({
      where: {
        creeLe: {
          gte: startDate,
          lte: endDate,
        },
      },
      select: {
        id: true,
        montant: true,
        montantNet: true,
        montantCommission: true,
        methode: true,
        statut: true,
        referenceTransaction: true,
        referenceFournisseur: true,
        gatewayReference: true,
        creeLe: true,
        client: { select: { nom: true } },
        professionnel: {
          select: {
            id: true,
            nomEntreprise: true,
            ville: true,
            utilisateur: { select: { nom: true } },
          },
        },
        reservation: {
          select: {
            service: { select: { nom: true } },
          },
        },
      },
      orderBy: { creeLe: 'asc' },
    });
  }

  private buildTotals(
    payments: PaymentRow[],
    successfulPayments: PaymentRow[],
    refundedPayments: PaymentRow[],
  ) {
    const gross = this.sum(successfulPayments, 'montant');
    const net = this.sum(successfulPayments, 'montantNet');
    const commission = this.sum(successfulPayments, 'montantCommission');
    const refunded = this.sum(refundedPayments, 'montant');
    const totalPayments = payments.length;
    const successfulCount = successfulPayments.length;

    return {
      gross,
      net,
      commission,
      refunded,
      totalPayments,
      successfulPayments: successfulCount,
      refundedPayments: refundedPayments.length,
      pendingPayments: payments.filter(
        (payment) => payment.statut === StatutPaiement.EN_ATTENTE,
      ).length,
      failedPayments: payments.filter(
        (payment) => payment.statut === StatutPaiement.ECHEC,
      ).length,
      averageTicket:
        successfulCount > 0 ? Math.round(gross / successfulCount) : 0,
      successRate:
        totalPayments > 0
          ? Math.round((successfulCount / totalPayments) * 100)
          : 0,
    };
  }

  private buildSeries(
    buckets: Array<{ label: string; start: Date; end: Date }>,
    successfulPayments: PaymentRow[],
    refundedPayments: PaymentRow[],
  ) {
    return buckets.map((bucket) => {
      const successInBucket = successfulPayments.filter((payment) =>
        this.isInBucket(payment.creeLe, bucket),
      );
      const refundsInBucket = refundedPayments.filter((payment) =>
        this.isInBucket(payment.creeLe, bucket),
      );

      return {
        label: bucket.label,
        startDate: bucket.start,
        endDate: bucket.end,
        gross: this.sum(successInBucket, 'montant'),
        net: this.sum(successInBucket, 'montantNet'),
        commission: this.sum(successInBucket, 'montantCommission'),
        refunded: this.sum(refundsInBucket, 'montant'),
        transactions: successInBucket.length,
      };
    });
  }

  private buildMethodDistribution(successfulPayments: PaymentRow[]) {
    const total = this.sum(successfulPayments, 'montant');
    const labels: Record<MethodePaiement, string> = {
      WAVE: 'Wave',
      ORANGE_MONEY: 'Orange Money',
      CARTE: 'Carte bancaire',
    };

    return Object.values(MethodePaiement).map((method) => {
      const payments = successfulPayments.filter(
        (payment) => payment.methode === method,
      );
      const gross = this.sum(payments, 'montant');

      return {
        key: method,
        label: labels[method],
        gross,
        transactions: payments.length,
        share: total > 0 ? Math.round((gross / total) * 100) : 0,
      };
    });
  }

  private buildTopProviders(successfulPayments: PaymentRow[]) {
    const byProvider = new Map<
      string,
      {
        id: string;
        name: string;
        companyName: string | null;
        city: string | null;
        gross: number;
        net: number;
        transactions: number;
      }
    >();

    for (const payment of successfulPayments) {
      const provider = byProvider.get(payment.professionnel.id) ?? {
        id: payment.professionnel.id,
        name: payment.professionnel.utilisateur.nom,
        companyName: payment.professionnel.nomEntreprise,
        city: payment.professionnel.ville,
        gross: 0,
        net: 0,
        transactions: 0,
      };
      provider.gross += this.toNumber(payment.montant);
      provider.net += this.toNumber(payment.montantNet);
      provider.transactions += 1;
      byProvider.set(provider.id, provider);
    }

    return [...byProvider.values()]
      .sort((a, b) => b.gross - a.gross)
      .slice(0, 6);
  }

  private buildBuckets(period: AdminRevenuePeriod, now: Date) {
    if (period === '7d' || period === '30d') {
      const count = period === '7d' ? 7 : 30;
      return Array.from({ length: count }, (_, index) => {
        const start = this.startOfDay(now);
        start.setDate(start.getDate() - (count - 1 - index));
        const end = this.endOfDay(start);
        return {
          label: new Intl.DateTimeFormat('fr-FR', {
            day: '2-digit',
            month: 'short',
          })
            .format(start)
            .replace('.', ''),
          start,
          end,
        };
      });
    }

    if (period === '90d') {
      return Array.from({ length: 13 }, (_, index) => {
        const start = this.startOfDay(now);
        start.setDate(start.getDate() - 90 + index * 7);
        const end = this.endOfDay(start);
        end.setDate(end.getDate() + 6);
        return {
          label: `S${index + 1}`,
          start,
          end,
        };
      });
    }

    return Array.from({ length: 12 }, (_, index) => {
      const start = new Date(now.getFullYear(), now.getMonth() - 11 + index, 1);
      const end = new Date(start.getFullYear(), start.getMonth() + 1, 0);
      end.setHours(23, 59, 59, 999);
      return {
        label: new Intl.DateTimeFormat('fr-FR', { month: 'short' })
          .format(start)
          .replace('.', ''),
        start,
        end,
      };
    });
  }

  private isInBucket(date: Date, bucket: { start: Date; end: Date }): boolean {
    return date >= bucket.start && date <= bucket.end;
  }

  private startOfDay(date: Date): Date {
    const result = new Date(date);
    result.setHours(0, 0, 0, 0);
    return result;
  }

  private endOfDay(date: Date): Date {
    const result = new Date(date);
    result.setHours(23, 59, 59, 999);
    return result;
  }

  private sum<T extends 'montant' | 'montantNet' | 'montantCommission'>(
    payments: PaymentRow[],
    field: T,
  ): number {
    return payments.reduce(
      (sum, payment) => sum + this.toNumber(payment[field]),
      0,
    );
  }

  private toNumber(value: unknown): number {
    return Number(value ?? 0);
  }
}
