import { Injectable } from '@nestjs/common';
import {
  Prisma,
  RoleUtilisateur,
  StatutPaiement,
  StatutReservation,
  TypeTransactionPortefeuille,
} from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { domainMessage } from '../../../core/messages/domain-message.catalog';
import type {
  DisputeAdminListFilters,
  DisputeAdminListItem,
  DisputeListResult,
  DisputeResolutionResult,
  DisputesRepositoryPort,
} from '../../application/ports/disputes-repository.port';
import type {
  Dispute,
  DisputeResolutionDecision,
} from '../../domain/entities/dispute.entity';

const DISPUTE_INCLUDE = {
  reservation: {
    select: {
      id: true,
      statut: true,
      dateHeure: true,
      adresseClient: true,
      dureeMinutes: true,
      prixConvenu: true,
      clientId: true,
      professionnelId: true,
      serviceId: true,
      service: {
        select: {
          id: true,
          nom: true,
          prix: true,
        },
      },
      client: {
        select: {
          id: true,
          nom: true,
        },
      },
      professionnel: {
        select: {
          id: true,
          utilisateurId: true,
          utilisateur: {
            select: {
              id: true,
              nom: true,
            },
          },
        },
      },
      conversation: {
        select: {
          messages: {
            select: {
              id: true,
              expediteurId: true,
              contenu: true,
              urlMedia: true,
              creeLe: true,
              expediteur: {
                select: {
                  id: true,
                  nom: true,
                  role: true,
                },
              },
            },
            orderBy: { creeLe: 'asc' },
            take: 20,
          },
        },
      },
    },
  },
  paiement: {
    select: {
      id: true,
      statut: true,
      escrowStatus: true,
      montant: true,
      montantNet: true,
      montantCommission: true,
      professionalId: true,
      processedAt: true,
      escrowReleasedAt: true,
      disputedAt: true,
      raisonRemboursement: true,
    },
  },
  reporter: {
    select: {
      id: true,
      nom: true,
      role: true,
    },
  },
  messagesMediation: {
    select: {
      id: true,
      destinataire: true,
      contenu: true,
      creeLe: true,
      expediteurAdmin: {
        select: {
          id: true,
          nom: true,
        },
      },
    },
    orderBy: { creeLe: 'asc' },
  },
} as const;

type DisputeRecord = Prisma.LitigeGetPayload<{
  include: typeof DISPUTE_INCLUDE;
}>;

@Injectable()
export class DisputesRepository implements DisputesRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<DisputeAdminListItem | null> {
    const dispute = await this.prisma.litige.findUnique({
      where: { id },
      include: DISPUTE_INCLUDE,
    });

    return dispute ? this.mapToAdminItem(dispute) : null;
  }

  async findByReservationId(
    reservationId: string,
  ): Promise<DisputeAdminListItem | null> {
    const dispute = await this.prisma.litige.findUnique({
      where: { reservationId },
      include: DISPUTE_INCLUDE,
    });

    return dispute ? this.mapToAdminItem(dispute) : null;
  }

  async createOrGetOpenForReservation(input: {
    dispute: Dispute;
    paymentId?: string | null;
  }): Promise<DisputeAdminListItem> {
    const created = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.litige.findUnique({
        where: { reservationId: input.dispute.reservationId },
        include: DISPUTE_INCLUDE,
      });

      if (existing) {
        if (!existing.paiementId && input.paymentId) {
          await tx.litige.update({
            where: { id: existing.id },
            data: { paiementId: input.paymentId, misAJourLe: new Date() },
          });
        }

        if (input.paymentId) {
          await this.markPaymentAsDisputedIfEligible(tx, input.paymentId);
        }

        const refreshed = await tx.litige.findUniqueOrThrow({
          where: { id: existing.id },
          include: DISPUTE_INCLUDE,
        });
        return refreshed;
      }

      if (input.paymentId) {
        await this.markPaymentAsDisputedIfEligible(tx, input.paymentId);
      }

      return tx.litige.create({
        data: {
          id: input.dispute.id,
          reservationId: input.dispute.reservationId,
          paiementId: input.paymentId ?? null,
          reporterUserId: input.dispute.reporterUserId,
          statut: input.dispute.statut,
          priorite: input.dispute.priorite,
          raison: input.dispute.raison,
          notesInternes: input.dispute.notesInternes,
          decisionResolution: input.dispute.decisionResolution,
          pourcentageRemboursementClient:
            input.dispute.pourcentageRemboursementClient,
          montantRembourseClient: input.dispute.montantRembourseClient,
          montantPrestataire: input.dispute.montantPrestataire,
          ouvertLe: input.dispute.ouvertLe,
          prisEnChargeLe: input.dispute.prisEnChargeLe,
          resoluLe: input.dispute.resoluLe,
          rejeteLe: input.dispute.rejeteLe,
          creeLe: input.dispute.creeLe,
          misAJourLe: input.dispute.misAJourLe,
        },
        include: DISPUTE_INCLUDE,
      });
    });

    return this.mapToAdminItem(created);
  }

  async createOrGetOpenForPayment(input: {
    dispute: Dispute;
    paymentId: string;
  }): Promise<DisputeAdminListItem> {
    const payment = await this.prisma.paiement.findUnique({
      where: { id: input.paymentId },
      select: { reservationId: true },
    });

    if (!payment) {
      throw new Error('PAYMENT_NOT_FOUND_FOR_DISPUTE');
    }

    return this.createOrGetOpenForReservation({
      dispute: {
        ...input.dispute,
        reservationId: payment.reservationId,
      },
      paymentId: input.paymentId,
    });
  }

  async listForAdmin(
    filters: DisputeAdminListFilters,
  ): Promise<DisputeListResult> {
    const cursor = this.decodeCursor(filters.cursor);
    const disputes = await this.prisma.litige.findMany({
      where: {
        ...(filters.status ? { statut: filters.status } : {}),
        ...(filters.priority ? { priorite: filters.priority } : {}),
        ...(cursor
          ? {
              OR: [
                { ouvertLe: { lt: cursor.openedAt } },
                {
                  ouvertLe: cursor.openedAt,
                  id: { lt: cursor.id },
                },
              ],
            }
          : {}),
      },
      include: DISPUTE_INCLUDE,
      orderBy: [{ ouvertLe: 'desc' }, { id: 'desc' }],
      take: filters.limit + 1,
    });

    const hasMore = disputes.length > filters.limit;
    const items = disputes
      .slice(0, filters.limit)
      .map((item) => this.mapToAdminItem(item));
    const last = items.at(-1);

    return {
      items,
      nextCursor:
        hasMore && last
          ? this.encodeCursor({ openedAt: last.ouvertLe, id: last.id })
          : null,
    };
  }

  async markInReview(
    disputeId: string,
    adminUserId: string,
  ): Promise<DisputeAdminListItem | null> {
    const updated = await this.prisma.litige.updateMany({
      where: {
        id: disputeId,
        statut: 'OUVERT',
      },
      data: {
        statut: 'EN_REVUE',
        resolvedByAdminUserId: adminUserId,
        prisEnChargeLe: new Date(),
        misAJourLe: new Date(),
      },
    });

    if (updated.count !== 1) {
      return null;
    }

    return this.findById(disputeId);
  }

  async reject(dispute: Dispute): Promise<DisputeAdminListItem> {
    const updated = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.litige.findUniqueOrThrow({
        where: { id: dispute.id },
        include: DISPUTE_INCLUDE,
      });

      if (existing.paiementId && existing.paiement) {
        await this.releaseProfessionalFunds(tx, {
          disputeId: existing.id,
          paymentId: existing.paiementId,
          professionalId: existing.paiement.professionalId,
          payoutAmount: Number(existing.paiement.montantNet),
        });
      }

      await tx.reservation.update({
        where: { id: existing.reservationId },
        data: {
          statut: existing.paiementId
            ? StatutReservation.TERMINEE
            : StatutReservation.CONFIRMEE,
          misAJourLe: new Date(),
        },
      });

      return tx.litige.update({
        where: { id: dispute.id },
        data: {
          statut: dispute.statut,
          resolvedByAdminUserId: dispute.resolvedByAdminUserId,
          notesInternes: dispute.notesInternes,
          rejeteLe: dispute.rejeteLe,
          misAJourLe: dispute.misAJourLe,
        },
        include: DISPUTE_INCLUDE,
      });
    });

    return this.mapToAdminItem(updated);
  }

  async resolve(input: {
    dispute: Dispute;
    decision: DisputeResolutionDecision;
    clientRefundPercentage: number;
  }): Promise<DisputeResolutionResult> {
    const result = await this.prisma.$transaction(async (tx) => {
      const existing = await tx.litige.findUniqueOrThrow({
        where: { id: input.dispute.id },
        include: DISPUTE_INCLUDE,
      });

      const grossAmount = existing.paiement
        ? Number(existing.paiement.montant)
        : 0;
      const netAmount = existing.paiement
        ? Number(existing.paiement.montantNet)
        : 0;
      const refundRate = input.clientRefundPercentage / 100;
      const clientRefundAmount = this.roundMoney(grossAmount * refundRate);
      const professionalPayoutAmount = this.roundMoney(
        netAmount * (1 - refundRate),
      );

      if (existing.paiementId && existing.paiement) {
        if (professionalPayoutAmount > 0) {
          await this.releaseProfessionalFunds(tx, {
            disputeId: existing.id,
            paymentId: existing.paiementId,
            professionalId: existing.paiement.professionalId,
            payoutAmount: professionalPayoutAmount,
          });
        } else {
          await tx.paiement.update({
            where: { id: existing.paiementId },
            data: {
              statut: StatutPaiement.REMBOURSE,
              escrowStatus: 'REFUNDED',
              raisonRemboursement: input.dispute.notesInternes,
              misAJourLe: new Date(),
            },
          });
        }
      }

      await tx.reservation.update({
        where: { id: existing.reservationId },
        data: {
          statut:
            input.decision === 'REMBOURSER_CLIENT'
              ? StatutReservation.ANNULEE
              : StatutReservation.TERMINEE,
          misAJourLe: new Date(),
        },
      });

      const updated = await tx.litige.update({
        where: { id: input.dispute.id },
        data: {
          statut: input.dispute.statut,
          resolvedByAdminUserId: input.dispute.resolvedByAdminUserId,
          notesInternes: input.dispute.notesInternes,
          decisionResolution: input.dispute.decisionResolution,
          pourcentageRemboursementClient:
            input.dispute.pourcentageRemboursementClient,
          montantRembourseClient: clientRefundAmount,
          montantPrestataire: professionalPayoutAmount,
          resoluLe: input.dispute.resoluLe,
          misAJourLe: input.dispute.misAJourLe,
        },
        include: DISPUTE_INCLUDE,
      });

      return {
        dispute: this.mapToAdminItem(updated),
        clientRefundAmount,
        professionalPayoutAmount,
      };
    });

    return result;
  }

  async listAdminUserIds(): Promise<string[]> {
    const admins = await this.prisma.utilisateur.findMany({
      where: {
        role: RoleUtilisateur.ADMIN,
        estActif: true,
      },
      select: { id: true },
    });

    return admins.map((admin) => admin.id);
  }

  private async markPaymentAsDisputedIfEligible(
    tx: Prisma.TransactionClient,
    paymentId: string,
  ): Promise<void> {
    const payment = await tx.paiement.findUnique({
      where: { id: paymentId },
      select: { escrowStatus: true, disputedAt: true },
    });

    if (!payment || payment.escrowStatus !== 'LOCKED') {
      return;
    }

    await tx.paiement.update({
      where: { id: paymentId },
      data: {
        escrowStatus: 'DISPUTED',
        disputedAt: payment.disputedAt ?? new Date(),
        misAJourLe: new Date(),
      },
    });
  }

  private async releaseProfessionalFunds(
    tx: Prisma.TransactionClient,
    input: {
      disputeId: string;
      paymentId: string;
      professionalId: string;
      payoutAmount: number;
    },
  ): Promise<void> {
    const reference = `wallet:dispute-resolution:${input.disputeId}`;
    const existingTransaction = await tx.transactionPortefeuille.findUnique({
      where: { reference },
    });

    if (existingTransaction) {
      return;
    }

    await tx.paiement.update({
      where: { id: input.paymentId },
      data: {
        statut: StatutPaiement.SUCCES,
        escrowStatus: 'RELEASED',
        escrowReleasedAt: new Date(),
        misAJourLe: new Date(),
      },
    });

    const profile = await tx.profilProfessionnel.update({
      where: { id: input.professionalId },
      data: {
        soldePortefeuille: {
          increment: input.payoutAmount,
        },
      },
      select: { soldePortefeuille: true },
    });

    await tx.transactionPortefeuille.create({
      data: {
        profilProfessionnelId: input.professionalId,
        paiementId: input.paymentId,
        type: TypeTransactionPortefeuille.CREDIT_ESCROW,
        montant: input.payoutAmount,
        soldeApres: profile.soldePortefeuille,
        description: domainMessage('DISPUTE_WALLET_TRANSACTION_DESCRIPTION'),
        reference,
      },
    });
  }

  private mapToAdminItem(record: DisputeRecord): DisputeAdminListItem {
    return {
      id: record.id,
      reservationId: record.reservationId,
      paiementId: record.paiementId,
      reporterUserId: record.reporterUserId,
      resolvedByAdminUserId: record.resolvedByAdminUserId,
      statut: record.statut,
      priorite: record.priorite,
      raison: record.raison,
      notesInternes: record.notesInternes,
      decisionResolution: record.decisionResolution,
      pourcentageRemboursementClient: record.pourcentageRemboursementClient,
      montantRembourseClient: record.montantRembourseClient
        ? Number(record.montantRembourseClient)
        : null,
      montantPrestataire: record.montantPrestataire
        ? Number(record.montantPrestataire)
        : null,
      ouvertLe: record.ouvertLe,
      prisEnChargeLe: record.prisEnChargeLe,
      resoluLe: record.resoluLe,
      rejeteLe: record.rejeteLe,
      creeLe: record.creeLe,
      misAJourLe: record.misAJourLe,
      reservation: {
        id: record.reservation.id,
        statut: record.reservation.statut,
        dateHeure: record.reservation.dateHeure,
        adresseClient: record.reservation.adresseClient,
        dureeMinutes: record.reservation.dureeMinutes,
        prixConvenu: record.reservation.prixConvenu
          ? Number(record.reservation.prixConvenu)
          : null,
        clientId: record.reservation.clientId,
        professionnelId: record.reservation.professionnelId,
        serviceId: record.reservation.serviceId,
        service: {
          id: record.reservation.service.id,
          nom: record.reservation.service.nom,
          prix: Number(record.reservation.service.prix),
        },
        messages: record.reservation.conversation?.messages.map((message) => ({
          id: message.id,
          expediteurId: message.expediteurId,
          contenu: message.contenu,
          urlMedia: message.urlMedia,
          creeLe: message.creeLe,
          expediteur: {
            id: message.expediteur.id,
            nom: message.expediteur.nom,
            role: message.expediteur.role,
          },
        })) ?? [],
        mediationMessages: record.messagesMediation.map((message) => ({
          id: message.id,
          destinataire: message.destinataire,
          contenu: message.contenu,
          creeLe: message.creeLe,
          expediteurAdmin: {
            id: message.expediteurAdmin.id,
            nom: message.expediteurAdmin.nom,
          },
        })),
      },
      payment: record.paiement
        ? {
            id: record.paiement.id,
            statut: record.paiement.statut,
            escrowStatus: record.paiement.escrowStatus,
            montant: Number(record.paiement.montant),
            montantNet: Number(record.paiement.montantNet),
          }
        : null,
      reporter: {
        id: record.reporter.id,
        nom: record.reporter.nom,
        role: record.reporter.role,
      },
      client: {
        id: record.reservation.client.id,
        nom: record.reservation.client.nom,
      },
      professional: {
        profileId: record.reservation.professionnel.id,
        userId: record.reservation.professionnel.utilisateur.id,
        nom: record.reservation.professionnel.utilisateur.nom,
      },
    };
  }

  private encodeCursor(input: { openedAt: Date; id: string }): string {
    return Buffer.from(
      JSON.stringify({
        openedAt: input.openedAt.toISOString(),
        id: input.id,
      }),
      'utf8',
    ).toString('base64url');
  }

  private decodeCursor(cursor?: string): { openedAt: Date; id: string } | null {
    if (!cursor) {
      return null;
    }

    try {
      const parsed = JSON.parse(
        Buffer.from(cursor, 'base64url').toString('utf8'),
      ) as { openedAt?: string; id?: string };
      if (!parsed.openedAt || !parsed.id) {
        return null;
      }

      return {
        openedAt: new Date(parsed.openedAt),
        id: parsed.id,
      };
    } catch {
      return null;
    }
  }

  private roundMoney(value: number): number {
    return Math.round(value * 100) / 100;
  }
}
