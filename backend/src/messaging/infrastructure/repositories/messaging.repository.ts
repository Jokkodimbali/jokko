import { Injectable, Logger } from '@nestjs/common';
import { Prisma, TypeNotification } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import type { NotificationView } from '../../../notifications/domain/entities/notification.entity';
import type {
  ConversationMessageView,
  ConversationView,
  CreateConversationInput,
  CreateConversationMessageInput,
  CreateConversationMessageResult,
  CreateConversationResult,
  MessagingRepositoryPort,
} from '../../application/ports/messaging-repository.port';

type PrismaConversationRecord = {
  id: string;
  clientId: string;
  prestataireId: string;
  reservationId: string | null;
  dernierMessageLe: Date | null;
  creeLe: Date;
  client: { id: string; nom: string; urlAvatar: string | null };
  prestataire: {
    id: string;
    nom: string;
    urlAvatar: string | null;
    profilProfessionnel: { id: string } | null;
  };
  messages: Array<{
    id: string;
    expediteurId: string;
    contenu: string | null;
    urlMedia: string | null;
    creeLe: Date;
  }>;
  _count: { messages: number };
};

type PrismaMessageRecord = {
  id: string;
  conversationId: string;
  expediteurId: string;
  contenu: string | null;
  urlMedia: string | null;
  estLu: boolean;
  creeLe: Date;
  expediteur: {
    id: string;
    nom: string;
    urlAvatar: string | null;
  };
};

type PrismaNotificationRecord = {
  id: string;
  utilisateurId: string;
  type: TypeNotification;
  titre: string;
  corps: string;
  donnees: Prisma.JsonValue | null;
  estLue: boolean;
  creeLe: Date;
};

@Injectable()
export class MessagingRepository implements MessagingRepositoryPort {
  private readonly logger = new Logger(MessagingRepository.name);

  constructor(private readonly prisma: PrismaService) {}

  async listConversationsForUser(params: {
    userId: string;
    limit: number;
    offset: number;
  }): Promise<ConversationView[]> {
    const conversations = await this.prisma.conversation.findMany({
      where: {
        OR: [{ clientId: params.userId }, { prestataireId: params.userId }],
      },
      orderBy: [{ dernierMessageLe: 'desc' }, { creeLe: 'desc' }],
      take: params.limit,
      skip: params.offset,
      select: this.buildConversationSelect(params.userId),
    });

    return conversations.map((conversation) =>
      this.mapConversation(conversation, params.userId),
    );
  }

  async findConversationById(
    conversationId: string,
    currentUserId: string,
  ): Promise<ConversationView | null> {
    const conversation = await this.prisma.conversation.findFirst({
      where: {
        id: conversationId,
        OR: [{ clientId: currentUserId }, { prestataireId: currentUserId }],
      },
      select: this.buildConversationSelect(currentUserId),
    });

    return conversation
      ? this.mapConversation(conversation, currentUserId)
      : null;
  }

  async findConversationByReservationId(
    reservationId: string,
    currentUserId: string,
  ): Promise<ConversationView | null> {
    const conversation = await this.prisma.conversation.findFirst({
      where: {
        reservationId,
        OR: [{ clientId: currentUserId }, { prestataireId: currentUserId }],
      },
      select: this.buildConversationSelect(currentUserId),
    });

    return conversation
      ? this.mapConversation(conversation, currentUserId)
      : null;
  }

  async findDirectConversationByParticipants(params: {
    clientUserId: string;
    professionalUserId: string;
    currentUserId: string;
  }): Promise<ConversationView | null> {
    const conversation = await this.prisma.conversation.findFirst({
      where: {
        clientId: params.clientUserId,
        prestataireId: params.professionalUserId,
        OR: [
          { clientId: params.currentUserId },
          { prestataireId: params.currentUserId },
        ],
      },
      orderBy: [{ dernierMessageLe: 'desc' }, { creeLe: 'desc' }],
      select: this.buildConversationSelect(params.currentUserId),
    });

    return conversation
      ? this.mapConversation(conversation, params.currentUserId)
      : null;
  }

  async createConversation(
    input: CreateConversationInput,
    currentUserId: string,
  ): Promise<CreateConversationResult> {
    const existingByReservation = input.reservationId
      ? await this.findConversationByReservationId(
          input.reservationId,
          currentUserId,
        )
      : null;
    if (existingByReservation) {
      return { conversation: existingByReservation, wasCreated: false };
    }

    const existingByParticipants =
      await this.findDirectConversationByParticipants({
        clientUserId: input.clientUserId,
        professionalUserId: input.professionalUserId,
        currentUserId,
      });
    if (existingByParticipants) {
      if (input.reservationId && !existingByParticipants.reservationId) {
        const updated = await this.prisma.conversation.update({
          where: { id: existingByParticipants.id },
          data: { reservationId: input.reservationId },
          select: this.buildConversationSelect(currentUserId),
        });

        return {
          conversation: this.mapConversation(updated, currentUserId),
          wasCreated: false,
        };
      }

      return { conversation: existingByParticipants, wasCreated: false };
    }

    try {
      const created = await this.prisma.conversation.create({
        data: {
          clientId: input.clientUserId,
          prestataireId: input.professionalUserId,
          reservationId: input.reservationId ?? null,
        },
        select: this.buildConversationSelect(currentUserId),
      });

      await this.persistOutboxEvent('messaging.conversation.created', {
        conversationId: created.id,
        clientUserId: input.clientUserId,
        professionalUserId: input.professionalUserId,
        reservationId: input.reservationId ?? null,
      });

      return {
        conversation: this.mapConversation(created, currentUserId),
        wasCreated: true,
      };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const conflictConversation = input.reservationId
          ? await this.findConversationByReservationId(
              input.reservationId,
              currentUserId,
            )
          : await this.findDirectConversationByParticipants({
              clientUserId: input.clientUserId,
              professionalUserId: input.professionalUserId,
              currentUserId,
            });
        if (conflictConversation) {
          return { conversation: conflictConversation, wasCreated: false };
        }

        const participantConflict =
          await this.findDirectConversationByParticipants({
            clientUserId: input.clientUserId,
            professionalUserId: input.professionalUserId,
            currentUserId,
          });
        if (participantConflict) {
          return { conversation: participantConflict, wasCreated: false };
        }
      }

      throw error;
    }
  }

  async listMessages(params: {
    conversationId: string;
    limit: number;
    offset: number;
  }): Promise<ConversationMessageView[]> {
    const messages = await this.prisma.message.findMany({
      where: { conversationId: params.conversationId },
      orderBy: { creeLe: 'desc' },
      take: params.limit,
      skip: params.offset,
      select: this.buildMessageSelect(),
    });

    return messages.reverse().map((message) => this.mapMessage(message));
  }

  async markMessagesAsRead(
    conversationId: string,
    currentUserId: string,
  ): Promise<number> {
    const result = await this.prisma.message.updateMany({
      where: {
        conversationId,
        expediteurId: { not: currentUserId },
        estLu: false,
      },
      data: { estLu: true },
    });

    return result.count;
  }

  async createMessage(
    input: CreateConversationMessageInput,
  ): Promise<CreateConversationMessageResult> {
    const createdAt = new Date();

    const result = await this.prisma.$transaction(async (tx) => {
      const message = await tx.message.create({
        data: {
          conversationId: input.conversationId,
          expediteurId: input.senderId,
          contenu: input.content,
          urlMedia: input.mediaUrl,
        },
        select: this.buildMessageSelect(),
      });

      await tx.conversation.update({
        where: { id: input.conversationId },
        data: { dernierMessageLe: createdAt },
      });

      const notification = await tx.notification.create({
        data: {
          utilisateurId: input.recipientUserId,
          type: TypeNotification.NOUVEAU_MESSAGE,
          titre: input.notification.title,
          corps: input.notification.body,
          donnees: {
            ...input.notification.data,
            messageId: message.id,
          } as Prisma.InputJsonObject,
        },
      });

      return {
        message,
        notification,
      };
    });

    await this.persistOutboxEvent('messaging.message.sent', {
      conversationId: input.conversationId,
      messageId: result.message.id,
      senderId: input.senderId,
      recipientUserId: input.recipientUserId,
    });

    return {
      message: this.mapMessage(result.message),
      notification: this.mapNotification(result.notification),
    };
  }

  private async persistOutboxEvent(
    typeEvenement: string,
    payload: Prisma.InputJsonObject,
  ): Promise<void> {
    try {
      await this.prisma.evenementOutbox.create({
        data: {
          typeEvenement,
          payload,
          statut: 'EN_ATTENTE',
        },
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : JSON.stringify(error);
      this.logger.error(
        `Failed to persist messaging outbox event ${typeEvenement}: ${errorMessage}`,
      );
    }
  }

  private buildConversationSelect(currentUserId: string) {
    return {
      id: true,
      clientId: true,
      prestataireId: true,
      reservationId: true,
      dernierMessageLe: true,
      creeLe: true,
      client: {
        select: {
          id: true,
          nom: true,
          urlAvatar: true,
        },
      },
      prestataire: {
        select: {
          id: true,
          nom: true,
          urlAvatar: true,
          profilProfessionnel: {
            select: {
              id: true,
            },
          },
        },
      },
      messages: {
        take: 1,
        orderBy: { creeLe: 'desc' as const },
        select: {
          id: true,
          expediteurId: true,
          contenu: true,
          urlMedia: true,
          creeLe: true,
        },
      },
      _count: {
        select: {
          messages: {
            where: {
              estLu: false,
              expediteurId: { not: currentUserId },
            },
          },
        },
      },
    };
  }

  private buildMessageSelect() {
    return {
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
    } as const;
  }

  private mapConversation(
    conversation: PrismaConversationRecord,
    currentUserId: string,
  ): ConversationView {
    const isClient = conversation.clientId === currentUserId;
    const counterpart = isClient
      ? {
          userId: conversation.prestataire.id,
          professionalProfileId:
            conversation.prestataire.profilProfessionnel?.id ?? null,
          name: conversation.prestataire.nom,
          avatarUrl: conversation.prestataire.urlAvatar,
        }
      : {
          userId: conversation.client.id,
          professionalProfileId: null,
          name: conversation.client.nom,
          avatarUrl: conversation.client.urlAvatar,
        };
    const lastMessage = conversation.messages[0] ?? null;

    return {
      id: conversation.id,
      clientUserId: conversation.clientId,
      professionalUserId: conversation.prestataireId,
      professionalProfileId:
        conversation.prestataire.profilProfessionnel?.id ?? null,
      reservationId: conversation.reservationId,
      lastMessageAt: conversation.dernierMessageLe,
      createdAt: conversation.creeLe,
      unreadCount: conversation._count.messages,
      counterpart,
      lastMessage: lastMessage
        ? {
            id: lastMessage.id,
            senderId: lastMessage.expediteurId,
            content: lastMessage.contenu,
            mediaUrl: lastMessage.urlMedia,
            createdAt: lastMessage.creeLe,
          }
        : null,
    };
  }

  private mapMessage(message: PrismaMessageRecord): ConversationMessageView {
    return {
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
  }

  private mapNotification(
    notification: PrismaNotificationRecord,
  ): NotificationView {
    return {
      id: notification.id,
      userId: notification.utilisateurId,
      type: notification.type,
      title: notification.titre,
      body: notification.corps,
      data:
        notification.donnees &&
        typeof notification.donnees === 'object' &&
        !Array.isArray(notification.donnees)
          ? (notification.donnees as Record<string, unknown>)
          : null,
      isRead: notification.estLue,
      createdAt: notification.creeLe,
    };
  }
}
