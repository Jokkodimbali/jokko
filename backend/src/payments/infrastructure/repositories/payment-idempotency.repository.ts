import { Injectable } from '@nestjs/common';
import { Prisma, StatutIdempotence } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  type PaymentIdempotencyPort,
  type PaymentIdempotencyRecord,
  type PaymentInitiationCache,
} from '../../application/ports/payment-idempotency.port';

const isPaymentInitiationCache = (
  value: Prisma.JsonValue,
): value is PaymentInitiationCache => {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return false;
  }

  const record = value as Record<string, unknown>;
  return (
    typeof record.paymentId === 'string' &&
    typeof record.paymentUrl === 'string' &&
    typeof record.gatewayReference === 'string'
  );
};

const toDomainStatus = (
  status: StatutIdempotence,
): PaymentIdempotencyRecord['status'] => status;

@Injectable()
export class PaymentIdempotencyRepository implements PaymentIdempotencyPort {
  constructor(private readonly prisma: PrismaService) {}

  async findByKey(key: string): Promise<PaymentIdempotencyRecord | null> {
    const record = await this.prisma.cleIdempotence.findUnique({
      where: { cle: key },
    });

    if (!record) {
      return null;
    }

    const response =
      record.reponse && isPaymentInitiationCache(record.reponse)
        ? record.reponse
        : null;

    return {
      key: record.cle,
      scope: record.portee,
      requestHash: record.hashRequete,
      status: toDomainStatus(record.statut),
      response,
      expiresAt: record.expireLe,
    };
  }

  async createInProgress(params: {
    key: string;
    scope: string;
    requestHash: string;
    expiresAt: Date;
  }): Promise<void> {
    await this.prisma.cleIdempotence.create({
      data: {
        cle: params.key,
        portee: params.scope,
        hashRequete: params.requestHash,
        expireLe: params.expiresAt,
      },
    });
  }

  async complete(key: string, response: PaymentInitiationCache): Promise<void> {
    await this.prisma.cleIdempotence.update({
      where: { cle: key },
      data: {
        statut: StatutIdempotence.TERMINE,
        reponse: response,
      },
    });
  }

  async fail(key: string): Promise<void> {
    await this.prisma.cleIdempotence.update({
      where: { cle: key },
      data: { statut: StatutIdempotence.ECHEC },
    });
  }
}
