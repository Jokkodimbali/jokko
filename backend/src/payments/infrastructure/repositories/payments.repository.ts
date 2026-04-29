import { Injectable } from '@nestjs/common';
import type {
  EscrowStatus as PrismaEscrowStatus,
  MethodePaiement,
  Prisma,
  StatutPaiement,
} from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import { PaymentsRepository } from '../../application/ports/payments-repository.port';
import { Payment } from '../../domain/entities/payment.entity';
import {
  EscrowStatus,
  PaymentMethod,
  PaymentStatus,
} from '../../domain/value-objects/payment-types.vo';

type PaymentRecord = Prisma.PaiementGetPayload<Record<string, never>>;

type ClientPaymentFilters = {
  status?: PaymentStatus;
  method?: PaymentMethod;
  limit?: number;
  offset?: number;
};

type ProfessionalPaymentFilters = {
  status?: PaymentStatus;
  escrowStatus?: EscrowStatus;
  limit?: number;
  offset?: number;
};

const toPrismaMethod = (method: PaymentMethod): MethodePaiement => {
  switch (method) {
    case PaymentMethod.WAVE:
      return 'WAVE';
    case PaymentMethod.ORANGE_MONEY:
      return 'ORANGE_MONEY';
    case PaymentMethod.CARD:
      return 'CARTE';
  }
};

const toPrismaStatus = (status: PaymentStatus): StatutPaiement => {
  switch (status) {
    case PaymentStatus.PENDING:
    case PaymentStatus.PROCESSING:
      return 'EN_ATTENTE';
    case PaymentStatus.SUCCESS:
      return 'SUCCES';
    case PaymentStatus.FAILED:
    case PaymentStatus.CANCELLED:
      return 'ECHEC';
    case PaymentStatus.REFUNDED:
      return 'REMBOURSE';
  }
};

const toDomainStatus = (status: StatutPaiement): PaymentStatus => {
  switch (status) {
    case 'EN_ATTENTE':
      return PaymentStatus.PENDING;
    case 'SUCCES':
      return PaymentStatus.SUCCESS;
    case 'ECHEC':
      return PaymentStatus.FAILED;
    case 'REMBOURSE':
      return PaymentStatus.REFUNDED;
  }
};

const toDomainMethod = (method: MethodePaiement): PaymentMethod => {
  switch (method) {
    case 'WAVE':
      return PaymentMethod.WAVE;
    case 'ORANGE_MONEY':
      return PaymentMethod.ORANGE_MONEY;
    case 'CARTE':
      return PaymentMethod.CARD;
  }
};

const toDomainEscrowStatus = (status: PrismaEscrowStatus): EscrowStatus => {
  return status as EscrowStatus;
};

const toPrismaEscrowStatus = (status: EscrowStatus): PrismaEscrowStatus => {
  return status as PrismaEscrowStatus;
};

const mapPaymentRecord = (record: PaymentRecord): Payment =>
  Payment.reconstitute({
    id: record.id,
    bookingId: record.reservationId,
    clientId: record.clientId,
    professionalId: record.professionalId,
    method: toDomainMethod(record.methode),
    status: toDomainStatus(record.statut),
    escrowStatus: toDomainEscrowStatus(record.escrowStatus),
    amount: Number(record.montant),
    commissionAmount: Number(record.montantCommission),
    netAmount: Number(record.montantNet),
    transactionReference:
      record.referenceTransaction || record.referenceFournisseur || null,
    gatewayReference: record.gatewayReference || null,
    processedAt: record.processedAt || null,
    escrowReleasedAt: record.escrowReleasedAt || null,
    disputedAt: record.disputedAt || null,
    refundReason: record.raisonRemboursement || null,
    createdAt: record.creeLe,
    updatedAt: record.misAJourLe || record.creeLe,
  });

@Injectable()
export class PaymentsRepositoryImpl implements PaymentsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async save(payment: Payment): Promise<void> {
    const data = {
      id: payment.id,
      reservationId: payment.bookingId,
      clientId: payment.clientId,
      professionalId: payment.professionalId,
      montant: payment.amount.getValue(),
      montantCommission: payment.commissionAmount.getValue(),
      montantNet: payment.netAmount.getValue(),
      methode: toPrismaMethod(payment.method),
      statut: toPrismaStatus(payment.status),
      escrowStatus: toPrismaEscrowStatus(payment.escrowStatus),
      referenceTransaction: payment.transactionReference?.getValue() || null,
      gatewayReference: payment.gatewayReference || null,
      processedAt: payment.processedAt,
      escrowReleasedAt: payment.escrowReleasedAt,
      disputedAt: payment.disputedAt,
      raisonRemboursement: payment.refundReason,
    };

    await this.prisma.paiement.upsert({
      where: { id: payment.id },
      update: data,
      create: data,
    });
  }

  async findById(id: string): Promise<Payment | null> {
    const record = await this.prisma.paiement.findUnique({ where: { id } });
    return record ? mapPaymentRecord(record) : null;
  }

  async findByBookingId(bookingId: string): Promise<Payment | null> {
    const record = await this.prisma.paiement.findUnique({
      where: { reservationId: bookingId },
    });
    return record ? mapPaymentRecord(record) : null;
  }

  async findByTransactionReference(reference: string): Promise<Payment | null> {
    const record = await this.prisma.paiement.findFirst({
      where: {
        OR: [
          { referenceTransaction: reference },
          { referenceFournisseur: reference },
          { gatewayReference: reference },
        ],
      },
    });
    return record ? mapPaymentRecord(record) : null;
  }

  async findByClientId(
    clientId?: string,
    filters?: ClientPaymentFilters,
  ): Promise<Payment[]> {
    const records = await this.prisma.paiement.findMany({
      where: this.buildClientWhere(clientId, filters),
      orderBy: { creeLe: 'desc' },
      take: filters?.limit || 20,
      skip: filters?.offset || 0,
    });

    return records.map(mapPaymentRecord);
  }

  async findByProfessionalId(
    professionalId?: string,
    filters?: ProfessionalPaymentFilters,
  ): Promise<Payment[]> {
    const records = await this.prisma.paiement.findMany({
      where: this.buildProfessionalWhere(professionalId, filters),
      orderBy: { creeLe: 'desc' },
      take: filters?.limit || 20,
      skip: filters?.offset || 0,
    });

    return records.map(mapPaymentRecord);
  }

  async countByClientId(
    clientId?: string,
    filters?: ClientPaymentFilters,
  ): Promise<number> {
    return this.prisma.paiement.count({
      where: this.buildClientWhere(clientId, filters),
    });
  }

  async countByProfessionalId(
    professionalId?: string,
    filters?: ProfessionalPaymentFilters,
  ): Promise<number> {
    return this.prisma.paiement.count({
      where: this.buildProfessionalWhere(professionalId, filters),
    });
  }

  async updatePaymentStatus(
    id: string,
    status: PaymentStatus,
    gatewayReference?: string,
    processedAt?: Date,
  ): Promise<void> {
    await this.prisma.paiement.update({
      where: { id },
      data: {
        statut: toPrismaStatus(status),
        gatewayReference,
        processedAt,
        misAJourLe: new Date(),
      },
    });
  }

  async updateEscrowStatus(
    id: string,
    escrowStatus: EscrowStatus,
    escrowReleasedAt?: Date,
    disputedAt?: Date,
  ): Promise<void> {
    await this.prisma.paiement.update({
      where: { id },
      data: {
        escrowStatus: toPrismaEscrowStatus(escrowStatus),
        escrowReleasedAt,
        disputedAt,
        misAJourLe: new Date(),
      },
    });
  }

  async findPendingEscrowReleases(): Promise<Payment[]> {
    const records = await this.prisma.paiement.findMany({
      where: {
        statut: 'SUCCES',
        escrowStatus: 'LOCKED',
      },
      orderBy: { creeLe: 'asc' },
    });

    return records.map(mapPaymentRecord);
  }

  async findExpiredPayments(): Promise<Payment[]> {
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);

    const records = await this.prisma.paiement.findMany({
      where: {
        statut: 'EN_ATTENTE',
        creeLe: { lt: thirtyMinutesAgo },
      },
    });

    return records.map(mapPaymentRecord);
  }

  async getAdminStatistics(): Promise<{
    totalPayments: number;
    totalRevenue: number;
    totalGrossAmount: number;
    pendingEscrowReleases: number;
    totalEscrowAmount: number;
  }> {
    const [
      totalPayments,
      paymentAggregates,
      pendingEscrowReleases,
      pendingEscrowAggregates,
    ] = await this.prisma.$transaction([
      this.prisma.paiement.count(),
      this.prisma.paiement.aggregate({
        where: { statut: 'SUCCES' },
        _sum: {
          montant: true,
          montantCommission: true,
        },
      }),
      this.prisma.paiement.count({
        where: {
          statut: 'SUCCES',
          escrowStatus: 'LOCKED',
        },
      }),
      this.prisma.paiement.aggregate({
        where: {
          statut: 'SUCCES',
          escrowStatus: 'LOCKED',
        },
        _sum: {
          montantNet: true,
        },
      }),
    ]);

    return {
      totalPayments,
      totalRevenue: Number(paymentAggregates._sum.montantCommission ?? 0),
      totalGrossAmount: Number(paymentAggregates._sum.montant ?? 0),
      pendingEscrowReleases,
      totalEscrowAmount: Number(pendingEscrowAggregates._sum.montantNet ?? 0),
    };
  }

  private buildClientWhere(
    clientId?: string,
    filters?: ClientPaymentFilters,
  ): Prisma.PaiementWhereInput {
    return {
      ...(clientId ? { clientId } : {}),
      ...(filters?.status ? { statut: toPrismaStatus(filters.status) } : {}),
      ...(filters?.method ? { methode: toPrismaMethod(filters.method) } : {}),
    };
  }

  private buildProfessionalWhere(
    professionalId?: string,
    filters?: ProfessionalPaymentFilters,
  ): Prisma.PaiementWhereInput {
    return {
      ...(professionalId ? { professionalId } : {}),
      ...(filters?.status ? { statut: toPrismaStatus(filters.status) } : {}),
      ...(filters?.escrowStatus
        ? { escrowStatus: toPrismaEscrowStatus(filters.escrowStatus) }
        : {}),
    };
  }
}
