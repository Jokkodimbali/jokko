import { Injectable } from '@nestjs/common';
import { Prisma, StatutWebhookPaiement } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  type PaymentWebhookEventPort,
  type PaymentWebhookEventRecord,
} from '../../application/ports/payment-webhook-event.port';

const toJsonPayload = (
  payload: Record<string, unknown>,
): Prisma.InputJsonValue => structuredClone(payload) as Prisma.InputJsonValue;

@Injectable()
export class PaymentWebhookEventRepository implements PaymentWebhookEventPort {
  constructor(private readonly prisma: PrismaService) {}

  async recordReceived(params: {
    eventKey: string;
    provider: string;
    providerReference: string;
    providerStatus: string;
    signatureValid: boolean;
    payload: Record<string, unknown>;
  }): Promise<PaymentWebhookEventRecord> {
    const existing = await this.prisma.evenementWebhookPaiement.findUnique({
      where: { cleEvenement: params.eventKey },
    });

    if (existing) {
      return {
        id: existing.id,
        eventKey: existing.cleEvenement,
        providerReference: existing.referenceFournisseur,
        providerStatus: existing.statutProvider,
        isReplay: true,
      };
    }

    const created = await this.prisma.evenementWebhookPaiement.create({
      data: {
        cleEvenement: params.eventKey,
        fournisseur: params.provider,
        referenceFournisseur: params.providerReference,
        statutProvider: params.providerStatus,
        signatureValide: params.signatureValid,
        payload: toJsonPayload(params.payload),
      },
    });

    return {
      id: created.id,
      eventKey: created.cleEvenement,
      providerReference: created.referenceFournisseur,
      providerStatus: created.statutProvider,
      isReplay: false,
    };
  }

  async markProcessed(eventKey: string): Promise<void> {
    await this.prisma.evenementWebhookPaiement.update({
      where: { cleEvenement: eventKey },
      data: {
        statut: StatutWebhookPaiement.TRAITE,
        traiteLe: new Date(),
      },
    });
  }

  async markFailed(eventKey: string, error: string): Promise<void> {
    await this.prisma.evenementWebhookPaiement.update({
      where: { cleEvenement: eventKey },
      data: {
        statut: StatutWebhookPaiement.ECHEC,
        erreur: error,
        traiteLe: new Date(),
      },
    });
  }
}
