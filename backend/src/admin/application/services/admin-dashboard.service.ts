import { Injectable } from '@nestjs/common';
import { appHttpException } from '../../../core/http/app-http.exception';
import { PrismaService } from '../../../prisma/prisma.service';
import type { AuthUser } from '../../../auth/security/auth-user.type';

@Injectable()
export class AdminDashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getDashboard(requestUser: AuthUser) {
    if (requestUser.role !== 'ADMIN') {
      throw appHttpException('USERS_ADMIN_FORBIDDEN_ROLE');
    }

    const [
      activeUsers,
      totalUsers,
      pendingKyc,
      pendingReservations,
      confirmedReservations,
      escrowReservations,
      inProgressReservations,
      openDisputes,
      inReviewDisputes,
      resolvedDisputes,
      rejectedDisputes,
      paymentStats,
    ] = await this.prisma.$transaction([
      this.prisma.utilisateur.count({ where: { estActif: true } }),
      this.prisma.utilisateur.count(),
      this.prisma.profilProfessionnel.count({
        where: { statutKyc: 'EN_ATTENTE' },
      }),
      this.prisma.reservation.count({ where: { statut: 'EN_ATTENTE' } }),
      this.prisma.reservation.count({ where: { statut: 'CONFIRMEE' } }),
      this.prisma.reservation.count({ where: { statut: 'PAYEE_SEQUESTRE' } }),
      this.prisma.reservation.count({ where: { statut: 'EN_COURS' } }),
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
    ]);

    return {
      users: {
        active: activeUsers,
        total: totalUsers,
      },
      kyc: {
        pending: pendingKyc,
      },
      reservations: {
        pending: pendingReservations,
        confirmed: confirmedReservations,
        inEscrow: escrowReservations,
        inProgress: inProgressReservations,
        active:
          pendingReservations +
          confirmedReservations +
          escrowReservations +
          inProgressReservations,
      },
      disputes: {
        open: openDisputes,
        inReview: inReviewDisputes,
        resolved: resolvedDisputes,
        rejected: rejectedDisputes,
      },
      revenue: {
        gross: Number(paymentStats._sum.montant ?? 0),
        commission: Number(paymentStats._sum.montantCommission ?? 0),
      },
    };
  }
}
