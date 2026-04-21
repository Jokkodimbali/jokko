import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { WithdrawalsRepository } from '../../application/ports/withdrawals-repository.port';
import { WithdrawalRequest } from '../../application/services/withdrawal.service';
import { Prisma, StatutRetrait, MethodePaiement } from '@prisma/client';
import { PaymentAmount } from '../../domain/value-objects/payment-amount.vo';

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
    status: string,
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

  private mapStatusToPrisma(status: string): StatutRetrait {
    switch (status) {
      case 'PROCESSING':
        return StatutRetrait.EN_COURS;
      case 'COMPLETED':
        return StatutRetrait.TERMINE;
      case 'FAILED':
        return StatutRetrait.ECHEC;
      case 'CANCELLED':
        return StatutRetrait.ANNULE;
      case 'PENDING':
      default:
        return StatutRetrait.EN_ATTENTE;
    }
  }

  private mapToDomain(
    record: Prisma.DemandeRetraitGetPayload<{ include: object }>,
  ): WithdrawalRequest {
    const mappedStatus:
      | 'PENDING'
      | 'PROCESSING'
      | 'COMPLETED'
      | 'FAILED'
      | 'CANCELLED' =
      record.statut === StatutRetrait.EN_ATTENTE
        ? 'PENDING'
        : record.statut === StatutRetrait.EN_COURS
          ? 'PROCESSING'
          : record.statut === StatutRetrait.TERMINE
            ? 'COMPLETED'
            : record.statut === StatutRetrait.ECHEC
              ? 'FAILED'
              : 'CANCELLED';

    return {
      id: record.id,
      professionalId: record.profilProfessionnelId,
      amount: PaymentAmount.create(Number(record.montant)),
      method:
        record.methode === MethodePaiement.CARTE
          ? 'CARTE'
          : record.methode === MethodePaiement.WAVE
            ? 'WAVE'
            : 'ORANGE_MONEY',
      status: mappedStatus,
      requestedAt: record.demandeLe,
      processedAt: record.traiteLe || undefined,
      gatewayReference: record.referenceFournisseur || undefined,
    };
  }
}
