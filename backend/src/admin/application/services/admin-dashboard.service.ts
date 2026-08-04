import { Injectable } from '@nestjs/common';
import { appHttpException } from '../../../core/http/app-http.exception';
import { PrismaService } from '../../../prisma/prisma.service';
import type { AuthUser } from '../../../auth/security/auth-user.type';
import { AdminTrafficAnalyticsService } from './admin-traffic-analytics.service';

@Injectable()
export class AdminDashboardService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly trafficAnalytics: AdminTrafficAnalyticsService,
  ) {}

  async getDashboard(requestUser: AuthUser) {
    if (requestUser.role !== 'ADMIN') {
      throw appHttpException('USERS_ADMIN_FORBIDDEN_ROLE');
    }

    const now = new Date();
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const previousMonthStart = new Date(
      now.getFullYear(),
      now.getMonth() - 1,
      1,
    );
    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(now.getDate() - 6);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    const [
      activeUsers,
      totalUsers,
      pendingKyc,
      totalProfessionals,
      confirmedReservations,
      escrowReservations,
      inProgressReservations,
      completedReservations,
      openDisputes,
      inReviewDisputes,
      resolvedDisputes,
      rejectedDisputes,
      paymentStats,
      monthlyPaymentStats,
      previousMonthlyPaymentStats,
      revenuePayments,
      categories,
      authTrafficSessions,
      recentAuditLogs,
      recentPayments,
    ] = await Promise.all([
      this.prisma.utilisateur.count({ where: { estActif: true } }),
      this.prisma.utilisateur.count(),
      this.prisma.profilProfessionnel.count({
        where: { statutKyc: 'EN_ATTENTE' },
      }),
      this.prisma.profilProfessionnel.count({
        where: { statutKyc: 'VERIFIE' },
      }),
      this.prisma.reservation.count({ where: { statut: 'CONFIRMEE' } }),
      this.prisma.reservation.count({ where: { statut: 'PAYEE_SEQUESTRE' } }),
      this.prisma.reservation.count({ where: { statut: 'EN_COURS' } }),
      this.prisma.reservation.count({ where: { statut: 'TERMINEE' } }),
      this.prisma.litige.count({ where: { statut: 'OUVERT' } }),
      this.prisma.litige.count({ where: { statut: 'EN_REVUE' } }),
      this.prisma.litige.count({ where: { statut: 'RESOLU' } }),
      this.prisma.litige.count({ where: { statut: 'REJETE' } }),
      this.prisma.paiement.aggregate({
        where: { statut: 'SUCCES' },
        _sum: {
          montant: true,
          montantCommission: true,
        },
      }),
      this.prisma.paiement.aggregate({
        where: { statut: 'SUCCES', creeLe: { gte: currentMonthStart } },
        _sum: { montant: true, montantCommission: true },
      }),
      this.prisma.paiement.aggregate({
        where: {
          statut: 'SUCCES',
          creeLe: { gte: previousMonthStart, lt: currentMonthStart },
        },
        _sum: { montant: true },
      }),
      this.prisma.paiement.findMany({
        where: {
          statut: 'SUCCES',
          creeLe: { gte: new Date(now.getFullYear(), now.getMonth() - 8, 1) },
        },
        select: {
          montant: true,
          montantCommission: true,
          creeLe: true,
        },
        orderBy: { creeLe: 'asc' },
      }),
      this.prisma.categorie.findMany({
        where: { estActive: true },
        select: {
          nom: true,
          services: {
            where: { estDisponible: true },
            select: { id: true },
          },
        },
        orderBy: { ordreTri: 'asc' },
      }),
      this.prisma.sessionAuthentification.findMany({
        where: { creeLe: { gte: sevenDaysAgo } },
        select: { creeLe: true, plateforme: true, utilisateurId: true },
        orderBy: { creeLe: 'asc' },
      }),
      this.prisma.journalAudit.findMany({
        take: 5,
        select: {
          nomUtilisateur: true,
          description: true,
          typeAction: true,
          creeLe: true,
        },
        orderBy: { creeLe: 'desc' },
      }),
      this.prisma.paiement.findMany({
        where: { statut: 'SUCCES' },
        take: 5,
        select: {
          montant: true,
          methode: true,
          creeLe: true,
          client: { select: { nom: true } },
        },
        orderBy: { creeLe: 'desc' },
      }),
    ]);

    const revenueGross = Number(paymentStats._sum.montant ?? 0);
    const monthlyRevenue = Number(monthlyPaymentStats._sum.montant ?? 0);
    const previousMonthlyRevenue = Number(
      previousMonthlyPaymentStats._sum.montant ?? 0,
    );
    const platformTotals =
      this.trafficAnalytics.buildPlatformTotals(authTrafficSessions);
    const categoryDistribution = this.buildCategoryDistribution(categories);
    const trafficSeries = this.trafficAnalytics.buildTrafficSeries(
      authTrafficSessions,
      sevenDaysAgo,
    );

    return {
      users: {
        active: activeUsers,
        total: totalUsers,
      },
      kyc: {
        pending: pendingKyc,
      },
      reservations: {
        pending: 0,
        confirmed: confirmedReservations,
        inEscrow: escrowReservations,
        inProgress: inProgressReservations,
        active:
          confirmedReservations + escrowReservations + inProgressReservations,
        completed: completedReservations,
      },
      disputes: {
        open: openDisputes,
        inReview: inReviewDisputes,
        resolved: resolvedDisputes,
        rejected: rejectedDisputes,
      },
      revenue: {
        gross: revenueGross,
        commission: Number(paymentStats._sum.montantCommission ?? 0),
        monthlyGross: monthlyRevenue,
        monthlyCommission: Number(
          monthlyPaymentStats._sum.montantCommission ?? 0,
        ),
      },
      overview: {
        status: 'operationnel',
        kpis: [
          {
            key: 'revenue',
            label: "CHIFFRE D'AFFAIRE",
            value: revenueGross,
            unit: 'FCFA',
            trend: this.calculateTrend(monthlyRevenue, previousMonthlyRevenue),
            caption: 'Ce mois',
            tone: 'neutral',
          },
          {
            key: 'visitors',
            label: 'VISITEURS UNIQUES',
            value: totalUsers,
            unit: 'utilisateurs',
            trend: this.calculateTrend(activeUsers, totalUsers - activeUsers),
            caption: `${activeUsers} comptes actifs`,
            tone: 'neutral',
          },
          {
            key: 'providers',
            label: 'PRESTATAIRES ACTIFS',
            value: totalProfessionals,
            unit: 'prestataires',
            trend: this.calculateTrend(totalProfessionals, pendingKyc),
            caption: `${pendingKyc} en validation`,
            tone: 'success',
          },
          {
            key: 'disputes',
            label: 'LITIGES OUVERTS',
            value: openDisputes + inReviewDisputes,
            unit: 'litiges',
            trend: this.calculateTrend(
              openDisputes + inReviewDisputes,
              resolvedDisputes + rejectedDisputes,
            ),
            caption: `${resolvedDisputes + rejectedDisputes} clotures`,
            tone: 'danger',
          },
        ],
        platforms: [
          {
            key: 'web',
            label: 'Site web',
            value: platformTotals.web,
            share: this.percentage(platformTotals.web, platformTotals.total),
          },
          {
            key: 'ios',
            label: 'Application IOS',
            value: platformTotals.ios,
            share: this.percentage(platformTotals.ios, platformTotals.total),
          },
          {
            key: 'android',
            label: 'Application Android',
            value: platformTotals.android,
            share: this.percentage(
              platformTotals.android,
              platformTotals.total,
            ),
          },
        ],
        revenueSeries: this.buildRevenueSeries(revenuePayments, now),
        trafficSeries,
        categoryDistribution,
        recentActivity: this.buildRecentActivity(
          recentAuditLogs,
          recentPayments,
        ),
      },
    };
  }

  private buildCategoryDistribution(
    categories: { nom: string; services: { id: string }[] }[],
  ) {
    const rows = categories
      .map((category) => ({
        label: category.nom,
        value: category.services.length,
      }))
      .filter((category) => category.value > 0);
    const total = rows.reduce((sum, row) => sum + row.value, 0);

    return rows.slice(0, 6).map((row) => ({
      ...row,
      share: this.percentage(row.value, total),
    }));
  }

  private buildRevenueSeries(
    payments: { montant: unknown; montantCommission: unknown; creeLe: Date }[],
    now: Date,
  ) {
    const formatter = new Intl.DateTimeFormat('fr-FR', { month: 'short' });
    const rows = Array.from({ length: 9 }, (_, index) => {
      const date = new Date(now.getFullYear(), now.getMonth() - 8 + index, 1);
      return {
        year: date.getFullYear(),
        month: date.getMonth(),
        label: formatter.format(date).replace('.', ''),
        gross: 0,
        commission: 0,
      };
    });

    for (const payment of payments) {
      const row = rows.find(
        (item) =>
          item.year === payment.creeLe.getFullYear() &&
          item.month === payment.creeLe.getMonth(),
      );
      if (!row) continue;
      row.gross += Number(payment.montant ?? 0);
      row.commission += Number(payment.montantCommission ?? 0);
    }

    return rows.map(({ label, gross, commission }) => ({
      label,
      gross,
      commission,
    }));
  }

  private buildRecentActivity(
    auditLogs: {
      nomUtilisateur: string | null;
      description: string;
      typeAction: string;
      creeLe: Date;
    }[],
    payments: {
      montant: unknown;
      methode: string;
      creeLe: Date;
      client: { nom: string };
    }[],
  ) {
    const audit = auditLogs.map((log) => ({
      title: log.nomUtilisateur ?? log.typeAction,
      description: log.description,
      timestamp: log.creeLe,
    }));
    const paymentRows = payments.map((payment) => ({
      title: `Paiement ${payment.methode}`,
      description: `${payment.client.nom} - ${Number(payment.montant).toLocaleString('fr-FR')} FCFA`,
      timestamp: payment.creeLe,
    }));

    return [...audit, ...paymentRows]
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, 5);
  }

  private calculateTrend(current: number, previous: number): number {
    if (previous <= 0) return current > 0 ? 100 : 0;
    return Math.round(((current - previous) / previous) * 1000) / 10;
  }

  private percentage(value: number, total: number): number {
    if (total <= 0) return 0;
    return Math.round((value / total) * 100);
  }
}
