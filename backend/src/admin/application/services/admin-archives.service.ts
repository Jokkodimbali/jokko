import { Injectable } from '@nestjs/common';
import {
  StatutLitige,
  StatutPaiement,
  TypeTransactionPortefeuille,
} from '@prisma/client';
import type { AuthUser } from '../../../auth/security/auth-user.type';
import { appHttpException } from '../../../core/http/app-http.exception';
import { PrismaService } from '../../../prisma/prisma.service';
type DecimalLike = { toNumber(): number };
type AdminArchiveTab = 'closedDisputes' | 'invoices' | 'transactions';
type AdminArchivesQuery = {
  tab?: AdminArchiveTab;
  limit?: number;
  offset?: number;
  search?: string;
};

type ClosedDisputeRow = Awaited<
  ReturnType<AdminArchivesService['findClosedDisputes']>
>[number];
type InvoiceRow = Awaited<
  ReturnType<AdminArchivesService['findInvoices']>
>[number];
type WalletTransactionRow = Awaited<
  ReturnType<AdminArchivesService['findWalletTransactions']>
>[number];

@Injectable()
export class AdminArchivesService {
  constructor(private readonly prisma: PrismaService) {}

  async getArchives(requestUser: AuthUser, query: AdminArchivesQuery = {}) {
    if (requestUser.role !== 'ADMIN') {
      throw appHttpException('USERS_ADMIN_FORBIDDEN_ROLE');
    }

    const tab = query.tab ?? 'transactions';
    const limit = query.limit ?? 10;
    const offset = query.offset ?? 0;
    const [
      closedDisputesCount,
      invoicesCount,
      transactionsCount,
      invoiceTotals,
      transactionTotals,
      rows,
    ] = await Promise.all([
      this.prisma.litige.count({
        where: { statut: { in: [StatutLitige.RESOLU, StatutLitige.REJETE] } },
      }),
      this.prisma.paiement.count({
        where: {
          statut: { in: [StatutPaiement.SUCCES, StatutPaiement.REMBOURSE] },
        },
      }),
      this.prisma.transactionPortefeuille.count(),
      this.prisma.paiement.aggregate({
        where: {
          statut: { in: [StatutPaiement.SUCCES, StatutPaiement.REMBOURSE] },
        },
        _sum: { montant: true, montantCommission: true },
      }),
      this.prisma.transactionPortefeuille.aggregate({
        _sum: { montant: true },
      }),
      this.findTabRows(tab, limit, offset, query.search?.trim()),
    ]);

    return {
      generatedAt: new Date(),
      totals: {
        closedDisputes: closedDisputesCount,
        invoices: invoicesCount,
        transactions: transactionsCount,
        invoiceGrossAmount: this.toNumber(invoiceTotals._sum.montant),
        invoiceCommissionAmount: this.toNumber(
          invoiceTotals._sum.montantCommission,
        ),
        transactionAmount: this.toNumber(transactionTotals._sum.montant),
      },
      pagination: {
        tab,
        total: this.tabTotal(tab, {
          closedDisputes: closedDisputesCount,
          invoices: invoicesCount,
          transactions: transactionsCount,
        }),
        limit,
        offset,
      },
      closedDisputes:
        tab === 'closedDisputes'
          ? (rows as ClosedDisputeRow[]).map((row) =>
              this.mapClosedDispute(row),
            )
          : [],
      invoices:
        tab === 'invoices'
          ? (rows as InvoiceRow[]).map((row) => this.mapInvoice(row))
          : [],
      transactions:
        tab === 'transactions'
          ? (rows as WalletTransactionRow[]).map((row) =>
              this.mapTransaction(row),
            )
          : [],
    };
  }

  private findTabRows(
    tab: AdminArchiveTab,
    limit: number,
    offset: number,
    search?: string,
  ) {
    if (tab === 'closedDisputes')
      return this.findClosedDisputes(limit, offset, search);
    if (tab === 'invoices') return this.findInvoices(limit, offset, search);
    return this.findWalletTransactions(limit, offset, search);
  }

  private tabTotal(
    tab: AdminArchiveTab,
    totals: { closedDisputes: number; invoices: number; transactions: number },
  ) {
    return totals[tab];
  }

  private findClosedDisputes(limit: number, offset: number, search?: string) {
    return this.prisma.litige.findMany({
      where: {
        statut: { in: [StatutLitige.RESOLU, StatutLitige.REJETE] },
        ...(search
          ? {
              OR: [
                { raison: { contains: search, mode: 'insensitive' } },
                {
                  reservation: {
                    client: { nom: { contains: search, mode: 'insensitive' } },
                  },
                },
                {
                  reservation: {
                    service: { nom: { contains: search, mode: 'insensitive' } },
                  },
                },
              ],
            }
          : {}),
      },
      select: {
        id: true,
        statut: true,
        priorite: true,
        raison: true,
        decisionResolution: true,
        montantRembourseClient: true,
        montantPrestataire: true,
        ouvertLe: true,
        resoluLe: true,
        rejeteLe: true,
        reservation: {
          select: {
            id: true,
            dateHeure: true,
            prixConvenu: true,
            service: { select: { nom: true } },
            client: { select: { nom: true } },
            professionnel: {
              select: {
                nomEntreprise: true,
                utilisateur: { select: { nom: true } },
              },
            },
          },
        },
        paiement: {
          select: {
            id: true,
            montant: true,
            montantCommission: true,
            montantNet: true,
            methode: true,
            statut: true,
            referenceTransaction: true,
          },
        },
      },
      orderBy: [
        { resoluLe: 'desc' },
        { rejeteLe: 'desc' },
        { misAJourLe: 'desc' },
      ],
      take: limit,
      skip: offset,
    });
  }

  private findInvoices(limit: number, offset: number, search?: string) {
    return this.prisma.paiement.findMany({
      where: {
        statut: { in: [StatutPaiement.SUCCES, StatutPaiement.REMBOURSE] },
        ...(search
          ? {
              OR: [
                {
                  referenceTransaction: {
                    contains: search,
                    mode: 'insensitive',
                  },
                },
                {
                  referenceFournisseur: {
                    contains: search,
                    mode: 'insensitive',
                  },
                },
                { client: { nom: { contains: search, mode: 'insensitive' } } },
                {
                  reservation: {
                    service: { nom: { contains: search, mode: 'insensitive' } },
                  },
                },
              ],
            }
          : {}),
      },
      select: {
        id: true,
        montant: true,
        montantCommission: true,
        montantNet: true,
        methode: true,
        statut: true,
        referenceTransaction: true,
        referenceFournisseur: true,
        gatewayReference: true,
        processedAt: true,
        creeLe: true,
        client: { select: { nom: true } },
        professionnel: {
          select: {
            nomEntreprise: true,
            utilisateur: { select: { nom: true } },
          },
        },
        reservation: {
          select: {
            id: true,
            dateHeure: true,
            service: { select: { nom: true } },
          },
        },
      },
      orderBy: { creeLe: 'desc' },
      take: limit,
      skip: offset,
    });
  }

  private findWalletTransactions(
    limit: number,
    offset: number,
    search?: string,
  ) {
    return this.prisma.transactionPortefeuille.findMany({
      where: search
        ? {
            OR: [
              { reference: { contains: search, mode: 'insensitive' } },
              { description: { contains: search, mode: 'insensitive' } },
              {
                profilProfessionnel: {
                  utilisateur: {
                    nom: { contains: search, mode: 'insensitive' },
                  },
                },
              },
            ],
          }
        : undefined,
      select: {
        id: true,
        type: true,
        montant: true,
        soldeApres: true,
        description: true,
        reference: true,
        creeLe: true,
        profilProfessionnel: {
          select: {
            nomEntreprise: true,
            utilisateur: { select: { nom: true } },
          },
        },
        paiement: {
          select: {
            id: true,
            methode: true,
            statut: true,
            client: { select: { nom: true } },
            reservation: {
              select: {
                service: { select: { nom: true } },
              },
            },
          },
        },
      },
      orderBy: { creeLe: 'desc' },
      take: limit,
      skip: offset,
    });
  }

  private mapClosedDispute(dispute: ClosedDisputeRow) {
    const closedAt = dispute.resoluLe ?? dispute.rejeteLe ?? dispute.ouvertLe;
    return {
      id: dispute.id,
      reference: `LT-${this.shortRef(dispute.id)}`,
      date: closedAt,
      type: dispute.reservation.service.nom,
      from: dispute.reservation.client.nom,
      to: this.professionalName(dispute.reservation.professionnel),
      amount: this.toNumber(
        dispute.paiement?.montant ?? dispute.reservation.prixConvenu,
      ),
      commission: this.toNumber(dispute.paiement?.montantCommission),
      status: dispute.statut,
      method: dispute.paiement?.methode ?? null,
      decision: dispute.decisionResolution,
      reason: dispute.raison,
    };
  }

  private mapInvoice(invoice: InvoiceRow) {
    return {
      id: invoice.id,
      reference:
        invoice.referenceTransaction ??
        invoice.referenceFournisseur ??
        invoice.gatewayReference ??
        `FA-${this.shortRef(invoice.id)}`,
      date: invoice.processedAt ?? invoice.creeLe,
      type: invoice.reservation.service.nom,
      from: invoice.client.nom,
      to: this.professionalName(invoice.professionnel),
      amount: this.toNumber(invoice.montant),
      commission: this.toNumber(invoice.montantCommission),
      netAmount: this.toNumber(invoice.montantNet),
      status: invoice.statut,
      method: invoice.methode,
    };
  }

  private mapTransaction(transaction: WalletTransactionRow) {
    const signedAmount = this.signedTransactionAmount(
      transaction.type,
      this.toNumber(transaction.montant),
    );

    return {
      id: transaction.id,
      reference: transaction.reference,
      date: transaction.creeLe,
      type: transaction.type,
      from: transaction.paiement?.client.nom ?? 'Plateforme Jokko',
      to: this.professionalName(transaction.profilProfessionnel),
      amount: signedAmount,
      commission:
        transaction.type === TypeTransactionPortefeuille.COMMISSION
          ? Math.abs(signedAmount)
          : 0,
      status: transaction.paiement?.statut ?? 'TERMINE',
      method: transaction.paiement?.methode ?? 'Portefeuille',
      description: transaction.description,
      balanceAfter: this.toNumber(transaction.soldeApres),
      serviceName: transaction.paiement?.reservation.service.nom ?? null,
    };
  }

  private signedTransactionAmount(
    type: TypeTransactionPortefeuille,
    amount: number,
  ) {
    return type === TypeTransactionPortefeuille.DEBIT_RETRAIT ||
      type === TypeTransactionPortefeuille.REMBOURSEMENT ||
      type === TypeTransactionPortefeuille.COMMISSION
      ? -Math.abs(amount)
      : Math.abs(amount);
  }

  private professionalName(professional: {
    nomEntreprise: string | null;
    utilisateur: { nom: string };
  }) {
    return professional.nomEntreprise ?? professional.utilisateur.nom;
  }

  private toNumber(value: unknown) {
    if (!value) return 0;
    if (typeof value === 'number') return value;
    if (
      typeof value === 'object' &&
      'toNumber' in value &&
      typeof (value as DecimalLike).toNumber === 'function'
    ) {
      return (value as DecimalLike).toNumber();
    }
    return Number(value) || 0;
  }

  private shortRef(id: string) {
    return id.replace(/-/g, '').slice(0, 8).toUpperCase();
  }
}
