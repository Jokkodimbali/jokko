import { BadRequestException, Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Prisma, TypeNotification } from '@prisma/client';
import type { AuthUser } from '../../../auth/security/auth-user.type';
import { appHttpException } from '../../../core/http/app-http.exception';
import { PrismaService } from '../../../prisma/prisma.service';

type DisputeMessageRecipient = 'CLIENT' | 'PRESTATAIRE' | 'TOUS';

@Injectable()
export class DisputeMediationMessageService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly realtimeEvents: EventEmitter2,
  ) {}

  async send(
    admin: AuthUser,
    disputeId: string,
    input: { recipient: DisputeMessageRecipient; content: string },
  ) {
    const content = input.content.trim();
    if (!content) {
      throw new BadRequestException('Le message de mediation est obligatoire.');
    }

    const dispute = await this.prisma.litige.findUnique({
      where: { id: disputeId },
      select: {
        id: true,
        reservation: {
          select: {
            id: true,
            clientId: true,
            professionnel: {
              select: {
                utilisateurId: true,
              },
            },
            conversation: {
              select: {
                id: true,
              },
            },
            service: {
              select: {
                nom: true,
              },
            },
          },
        },
      },
    });

    if (!dispute) {
      throw appHttpException('DISPUTES_NOT_FOUND');
    }

    const recipients = this.resolveRecipients(input.recipient, {
      clientId: dispute.reservation.clientId,
      professionalUserId: dispute.reservation.professionnel.utilisateurId,
    });

    const result = await this.prisma.$transaction(async (tx) => {
      const createdAt = new Date();
      const created = await tx.messageLitige.create({
        data: {
          litigeId: dispute.id,
          expediteurAdminId: admin.sub,
          destinataire: input.recipient,
          contenu: content,
        },
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
      });

      let conversationMessage: {
        id: string;
        conversationId: string;
        senderId: string;
        content: string | null;
        mediaUrl: string | null;
        isRead: boolean;
        createdAt: Date;
        sender: {
          id: string;
          name: string;
          avatarUrl: string | null;
        };
      } | null = null;

      if (input.recipient === 'TOUS') {
        const conversationId = await this.resolveConversationId(tx, {
          reservationId: dispute.reservation.id,
          clientId: dispute.reservation.clientId,
          professionalUserId: dispute.reservation.professionnel.utilisateurId,
          existingConversationId: dispute.reservation.conversation?.id ?? null,
        });

        const message = await tx.message.create({
          data: {
            conversationId,
            expediteurId: admin.sub,
            contenu: content,
            urlMedia: null,
            creeLe: createdAt,
          },
          select: {
            id: true,
            conversationId: true,
            expediteurId: true,
            contenu: true,
            urlMedia: true,
            estLu: true,
            creeLe: true,
            expediteur: {
              select: {
                id: true,
                nom: true,
                urlAvatar: true,
              },
            },
          },
        });

        conversationMessage = {
          id: message.id,
          conversationId: message.conversationId,
          senderId: message.expediteurId,
          content: message.contenu,
          mediaUrl: message.urlMedia,
          isRead: message.estLu,
          createdAt: message.creeLe,
          sender: {
            id: message.expediteur.id,
            name: message.expediteur.nom,
            avatarUrl: message.expediteur.urlAvatar,
          },
        };

        await tx.conversation.update({
          where: { id: conversationId },
          data: { dernierMessageLe: createdAt },
        });
      }

      await tx.notification.createMany({
        data: recipients.map((recipientId) => ({
          utilisateurId: recipientId,
          type: TypeNotification.ANNONCE_ADMIN,
          titre: 'Message de mediation',
          corps: content,
          donnees: {
            disputeId: dispute.id,
            serviceName: dispute.reservation.service.nom,
            recipient: input.recipient,
          } satisfies Prisma.InputJsonValue,
        })),
      });

      return { message: created, conversationMessage };
    });

    if (result.conversationMessage) {
      this.realtimeEvents.emit('conversation.message.created', {
        message: result.conversationMessage,
        recipientUserIds: recipients,
      });
    }

    return result.message;
  }

  private resolveRecipients(
    recipient: DisputeMessageRecipient,
    parties: { clientId: string; professionalUserId: string },
  ): string[] {
    if (recipient === 'CLIENT') return [parties.clientId];
    if (recipient === 'PRESTATAIRE') return [parties.professionalUserId];
    return Array.from(new Set([parties.clientId, parties.professionalUserId]));
  }

  private async resolveConversationId(
    tx: Prisma.TransactionClient,
    input: {
      reservationId: string;
      clientId: string;
      professionalUserId: string;
      existingConversationId: string | null;
    },
  ): Promise<string> {
    if (input.existingConversationId) {
      return input.existingConversationId;
    }

    const conversation = await tx.conversation.upsert({
      where: { reservationId: input.reservationId },
      create: {
        reservationId: input.reservationId,
        clientId: input.clientId,
        prestataireId: input.professionalUserId,
      },
      update: {},
      select: { id: true },
    });

    return conversation.id;
  }
}
