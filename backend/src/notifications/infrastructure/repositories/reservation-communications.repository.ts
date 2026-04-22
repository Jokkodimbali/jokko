import { Injectable } from '@nestjs/common';
import {
  CanalCommunication,
  StatutCommunication,
  type Prisma,
} from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  type CreateReservationCommunicationDispatchesInput,
  type ReservationCommunicationDispatches,
  type ReservationCommunicationsRepositoryPort,
  type UpdateReservationCommunicationDispatchInput,
} from '../../application/ports/reservation-communications-repository.port';

@Injectable()
export class ReservationCommunicationsRepository implements ReservationCommunicationsRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async createReservationCreatedDispatches(
    input: CreateReservationCommunicationDispatchesInput,
  ): Promise<ReservationCommunicationDispatches> {
    return this.prisma.$transaction(async (tx) => {
      const emailDispatch = input.email
        ? await tx.communicationReservation.create({
            data: {
              reservationId: input.reservationId,
              utilisateurId: input.userId,
              canal: CanalCommunication.EMAIL,
              destinataire: input.email,
              sujet: input.emailSubject,
              contenu: input.emailContent,
              metadata: this.toPrismaJson(input.metadata),
            },
            select: { id: true },
          })
        : null;

      const smsDispatch = await tx.communicationReservation.create({
        data: {
          reservationId: input.reservationId,
          utilisateurId: input.userId,
          canal: CanalCommunication.SMS,
          destinataire: input.phoneNumber,
          sujet: null,
          contenu: input.smsContent,
          metadata: this.toPrismaJson(input.metadata),
        },
        select: { id: true },
      });

      return {
        emailDispatchId: emailDispatch?.id ?? null,
        smsDispatchId: smsDispatch.id,
      };
    });
  }

  async updateDispatchResult(
    input: UpdateReservationCommunicationDispatchInput,
  ): Promise<void> {
    await this.prisma.communicationReservation.update({
      where: { id: input.dispatchId },
      data: {
        fournisseur: input.provider,
        identifiantFournisseur: input.providerMessageId ?? null,
        statut: this.toPrismaStatus(input.status),
        erreur: input.error ?? null,
        envoyeLe: input.status === 'ENVOYE' ? new Date() : null,
      },
    });
  }

  private toPrismaStatus(status: string): StatutCommunication {
    return StatutCommunication[status as keyof typeof StatutCommunication];
  }

  private toPrismaJson(metadata: Record<string, unknown>): Prisma.JsonObject {
    return metadata as Prisma.JsonObject;
  }
}
