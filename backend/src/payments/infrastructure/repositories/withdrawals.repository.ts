import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { WithdrawalsRepository } from '../../application/ports/withdrawals-repository.port';
import { WithdrawalRequest } from '../../domain/entities/withdrawal-request.entity';
import { Prisma, StatutRetrait, MethodePaiement } from '@prisma/client';
import { PaymentAmount } from '../../domain/value-objects/payment-amount.vo';
import { WithdrawalStatus } from '../../domain/value-objects/payment-types.vo';

@Injectable()
export class WithdrawalsRepositoryImpl implements WithdrawalsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async save(withdrawal: WithdrawalRequest): Promise<void> {
    await this.prisma.demandeRetrait.create({
      data: {
        id: withdrawal.id,
        profilProfessionnelId: withdrawal.professionalId,
        montant: withdrawal.amount.getValue(),
        methode: withdrawal.method as MethodePaiement,
        statut: this.mapStatusToPrisma(withdrawal.status),
        referenceFournisseur: withdrawal.gatewayReference,
        demandeLe: withdrawal.requestedAt,
        traiteLe: withdrawal.processedAt,
      },
    });
  }

  async updateStatus(
    id: string,
    status: WithdrawalStatus,
    processedAt?: Date,
    gatewayReference?: string,
  ): Promise<void> {
    await this.prisma.demandeRetrait.update({
      where: { id },
      data: {
        statut: this.mapStatusToPrisma(status),
        traiteLe: processedAt,
        referenceFournisseur: gatewayReference,
      },
    });
  }

  async findById(id: string): Promise<WithdrawalRequest | null> {
    const record = await this.prisma.demandeRetrait.findUnique({
      where: { id },
    });
    if (!record) return null;
    return this.mapToDomain(record);
  }

  async findByProfessionalId(
    professionalId: string,
  ): Promise<WithdrawalRequest[]> {
    const records = await this.prisma.demandeRetrait.findMany({
      where: { profilProfessionnelId: professionalId },
      orderBy: { demandeLe: 'desc' },
    });
    return records.map((record) => this.mapToDomain(record));
  }

  async findPending(): Promise<WithdrawalRequest[]> {
    const records = await this.prisma.demandeRetrait.findMany({
      where: { statut: StatutRetrait.EN_ATTENTE },
      orderBy: { demandeLe: 'asc' },
    });
    return records.map((record) => this.mapToDomain(record));
  }

  private mapStatusToPrisma(status: WithdrawalStatus): StatutRetrait {
    switch (status) {
      case WithdrawalStatus.PROCESSING:
        return StatutRetrait.EN_COURS;
      case WithdrawalStatus.COMPLETED:
        return StatutRetrait.TERMINE;
      case WithdrawalStatus.FAILED:
        return StatutRetrait.ECHEC;
      case WithdrawalStatus.CANCELLED:
        return StatutRetrait.ANNULE;
      case WithdrawalStatus.PENDING:
      default:
        return StatutRetrait.EN_ATTENTE;
    }
  }

  private mapToDomain(
    record: Prisma.DemandeRetraitGetPayload<{ include: object }>,
  ): WithdrawalRequest {
    const mappedStatus =
      record.statut === StatutRetrait.EN_ATTENTE
        ? WithdrawalStatus.PENDING
        : record.statut === StatutRetrait.EN_COURS
          ? WithdrawalStatus.PROCESSING
          : record.statut === StatutRetrait.TERMINE
            ? WithdrawalStatus.COMPLETED
            : record.statut === StatutRetrait.ECHEC
              ? WithdrawalStatus.FAILED
              : WithdrawalStatus.CANCELLED;

    return {
      id: record.id,
      professionalId: record.profilProfessionnelId,
      amount: PaymentAmount.create(Number(record.montant)),
      method: record.methode === MethodePaiement.WAVE ? 'WAVE' : 'ORANGE_MONEY',
      status: mappedStatus,
      requestedAt: record.demandeLe,
      processedAt: record.traiteLe || undefined,
      gatewayReference: record.referenceFournisseur || undefined,
    };
  }
}
