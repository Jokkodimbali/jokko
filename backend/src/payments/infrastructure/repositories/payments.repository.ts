import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { PaymentsRepository } from '../../application/ports/payments-repository.port';
import { Payment } from '../../domain/entities/payment.entity';
import {
  PaymentMethod,
  PaymentStatus,
  EscrowStatus,
} from '../../domain/value-objects/payment-types.vo';
import type {
  MethodePaiement,
  StatutPaiement,
  EscrowStatus as PrismaEscrowStatus,
} from '@prisma/client';

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
      return 'EN_ATTENTE';
    case PaymentStatus.PROCESSING:
      return 'EN_ATTENTE';
    case PaymentStatus.SUCCESS:
      return 'SUCCES';
    case PaymentStatus.FAILED:
      return 'ECHEC';
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
    const record = await this.prisma.paiement.findUnique({
      where: { id },
    });

    if (!record) {
      return null;
    }

    return Payment.reconstitute({
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
  }

  async findByBookingId(bookingId: string): Promise<Payment | null> {
    const record = await this.prisma.paiement.findUnique({
      where: { reservationId: bookingId },
    });

    if (!record) {
      return null;
    }

    return Payment.reconstitute({
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
  }

  async findByTransactionReference(reference: string): Promise<Payment | null> {
    const record = await this.prisma.paiement.findFirst({
      where: {
        OR: [
          { referenceTransaction: reference },
          { referenceFournisseur: reference },
        ],
      },
    });

    if (!record) {
      return null;
    }

    return Payment.reconstitute({
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
  }

  async findByClientId(
    clientId: string,
    filters?: {
      status?: PaymentStatus;
      method?: PaymentMethod;
      limit?: number;
      offset?: number;
    },
  ): Promise<Payment[]> {
    const where: Record<string, unknown> = { clientId };

    if (filters?.status) {
      where.statut = toPrismaStatus(filters.status);
    }

    if (filters?.method) {
      where.methode = toPrismaMethod(filters.method);
    }

    const records = await this.prisma.paiement.findMany({
      where,
      orderBy: { creeLe: 'desc' },
      take: filters?.limit || 20,
      skip: filters?.offset || 0,
    });

    return records.map((record) =>
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
      }),
    );
  }

  async findByProfessionalId(
    professionalId: string,
    filters?: {
      status?: PaymentStatus;
      escrowStatus?: EscrowStatus;
      limit?: number;
      offset?: number;
    },
  ): Promise<Payment[]> {
    const where: Record<string, unknown> = { professionalId };

    if (filters?.status) {
      where.statut = toPrismaStatus(filters.status);
    }

    if (filters?.escrowStatus) {
      where.escrowStatus = toPrismaEscrowStatus(filters.escrowStatus);
    }

    const records = await this.prisma.paiement.findMany({
      where,
      orderBy: { creeLe: 'desc' },
      take: filters?.limit || 20,
      skip: filters?.offset || 0,
    });

    return records.map((record) =>
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
      }),
    );
  }

  async countByClientId(
    clientId: string,
    filters?: {
      status?: PaymentStatus;
      method?: PaymentMethod;
    },
  ): Promise<number> {
    const where: Record<string, unknown> = { clientId };

    if (filters?.status) {
      where.statut = toPrismaStatus(filters.status);
    }

    if (filters?.method) {
      where.methode = toPrismaMethod(filters.method);
    }

    return this.prisma.paiement.count({ where });
  }

  async countByProfessionalId(
    professionalId: string,
    filters?: {
      status?: PaymentStatus;
      escrowStatus?: EscrowStatus;
    },
  ): Promise<number> {
    const where: Record<string, unknown> = { professionalId };

    if (filters?.status) {
      where.statut = toPrismaStatus(filters.status);
    }

    if (filters?.escrowStatus) {
      where.escrowStatus = toPrismaEscrowStatus(filters.escrowStatus);
    }

    return this.prisma.paiement.count({ where });
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

    return records.map((record) =>
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
      }),
    );
  }

  async findExpiredPayments(): Promise<Payment[]> {
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);

    const records = await this.prisma.paiement.findMany({
      where: {
        statut: 'EN_ATTENTE',
        creeLe: {
          lt: thirtyMinutesAgo,
        },
      },
    });

    return records.map((record) =>
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
      }),
    );
  }
}
