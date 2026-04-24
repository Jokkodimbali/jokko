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

  async createReservationDispatches(
    input: CreateReservationCommunicationDispatchesInput,
  ): Promise<ReservationCommunicationDispatches> {
    return this.prisma.$transaction(async (tx) => {
      const emailDispatch =
        input.email && input.emailSubject && input.emailContent
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

      const smsDispatch =
        input.phoneNumber && input.smsContent
          ? await tx.communicationReservation.create({
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
            })
          : null;

      return {
        emailDispatchId: emailDispatch?.id ?? null,
        smsDispatchId: smsDispatch?.id ?? null,
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
