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

      const deliveries: Array<{
        recipientId: string;
        message: {
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
            isAdmin: boolean;
          };
        };
      }> = [];

      for (const recipientId of recipients) {
        const conversationId = await this.resolveConversationId(
          tx,
          recipientId,
          admin.sub,
        );
        const message = await tx.message.create({
          data: {
            ...(input.recipient !== 'TOUS' ? { id: created.id } : {}),
            conversationId,
            expediteurId: admin.sub,
            litigeId: dispute.id,
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

        const conversationMessage = {
          id: message.id,
          conversationId: message.conversationId,
          senderId: message.expediteurId,
          content: message.contenu,
          mediaUrl: message.urlMedia,
          isRead: message.estLu,
          createdAt: message.creeLe,
          sender: {
            id: message.expediteur.id,
            name: 'Service client',
            avatarUrl: '/logojokko.png',
            isAdmin: true,
          },
        };

        await tx.conversation.update({
          where: { id: conversationId },
          data: { dernierMessageLe: createdAt },
        });
        deliveries.push({ recipientId, message: conversationMessage });

        await tx.notification.createMany({
          data: [
            {
              utilisateurId: recipientId,
              type: TypeNotification.ANNONCE_ADMIN,
              titre: 'Service client',
              corps: content,
              donnees: {
                disputeId: dispute.id,
                reservationId: dispute.reservation.id,
                conversationId,
                serviceName: dispute.reservation.service.nom,
                recipient: input.recipient,
              } satisfies Prisma.InputJsonValue,
            },
          ],
        });
      }

      return { message: created, deliveries };
    });

    for (const delivery of result.deliveries) {
      this.realtimeEvents.emit('conversation.message.created', {
        message: delivery.message,
        recipientUserIds: [delivery.recipientId, admin.sub],
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
    recipientId: string,
    adminId: string,
  ): Promise<string> {
    const conversation = await tx.conversation.upsert({
      where: {
        clientId_prestataireId: {
          clientId: recipientId,
          prestataireId: adminId,
        },
      },
      create: {
        clientId: recipientId,
        prestataireId: adminId,
      },
      update: {},
      select: { id: true },
    });

    return conversation.id;
  }
}
