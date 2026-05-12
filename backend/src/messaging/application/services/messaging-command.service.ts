import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { AuthUser } from '../../../auth/security/auth-user.type';
import { appHttpException } from '../../../core/http/app-http.exception';
import { MESSAGING_NOTIFICATION_MESSAGES } from '../../../core/messages/messaging-notification.messages';
import { NotificationDeliveryService } from '../../../notifications/application/services/notification-delivery.service';
import { trimString } from '../../../shared/utils/string.utils';
import {
  PROFESSIONALS_REPOSITORY_PORT,
  type ProfessionalsRepositoryPort,
} from '../../../professionals/application/ports/professionals-repository.port';
import {
  RESERVATIONS_REPOSITORY_PORT,
  type ReservationsRepositoryPort,
} from '../../../reservations/application/ports/reservations-repository.port';
import {
  USERS_REPOSITORY_PORT,
  type UsersRepositoryPort,
} from '../../../users/application/ports/users-repository.port';
import type {
  CreateConversationCommand,
  SendConversationMessageCommand,
} from '../commands/messaging.commands';
import { ConversationEntity } from '../../domain/entities/conversation.entity';
import { ConversationMessageEntity } from '../../domain/entities/conversation-message.entity';
import {
  MESSAGING_REPOSITORY_PORT,
  type MessagingRepositoryPort,
} from '../ports/messaging-repository.port';
import { MessagingAppService } from './messaging-app-service.base';

export type SentConversationMessage = {
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
    };
  };
  recipientUserId: string;
};

@Injectable()
export class MessagingCommandService extends MessagingAppService {
  constructor(
    @Inject(MESSAGING_REPOSITORY_PORT)
    messagingRepository: MessagingRepositoryPort,
    @Inject(USERS_REPOSITORY_PORT)
    usersRepository: UsersRepositoryPort,
    @Inject(PROFESSIONALS_REPOSITORY_PORT)
    professionalsRepository: ProfessionalsRepositoryPort,
    @Inject(RESERVATIONS_REPOSITORY_PORT)
    reservationsRepository: ReservationsRepositoryPort,
    private readonly notificationDeliveryService: NotificationDeliveryService,
  ) {
    super(
      messagingRepository,
      usersRepository,
      professionalsRepository,
      reservationsRepository,
    );
  }

  async createConversation(
    requestUser: AuthUser,
    command: CreateConversationCommand,
  ) {
    const participantContext = command.reservationId
      ? await this.resolveReservationConversationContext(
          requestUser,
          command.reservationId,
        )
      : await this.resolveDirectConversationContext(
          requestUser,
          command.professionalProfileId,
        );

    const existing = participantContext.reservationId
      ? await this.messagingRepository.findConversationByReservationId(
          participantContext.reservationId,
          requestUser.sub,
        )
      : await this.messagingRepository.findDirectConversationByParticipants({
          clientUserId: participantContext.clientUserId,
          professionalUserId: participantContext.professionalUserId,
          currentUserId: requestUser.sub,
        });
    if (existing) {
      return existing;
    }

    const conversation = ConversationEntity.create({
      id: randomUUID(),
      clientUserId: participantContext.clientUserId,
      professionalUserId: participantContext.professionalUserId,
      reservationId: participantContext.reservationId,
    });

    const result = await this.messagingRepository.createConversation(
      {
        clientUserId: conversation.clientUserId,
        professionalUserId: conversation.professionalUserId,
        reservationId: participantContext.reservationId,
      },
      requestUser.sub,
    );

    return result.conversation;
  }

  private async resolveDirectConversationContext(
    requestUser: AuthUser,
    professionalProfileId?: string,
  ): Promise<{
    clientUserId: string;
    professionalUserId: string;
    reservationId: string | null;
  }> {
    if (!professionalProfileId) {
      throw appHttpException('MESSAGING_RESERVATION_REQUIRED');
    }

    if (requestUser.role !== 'CLIENT') {
      throw appHttpException('MESSAGING_UNAUTHORIZED');
    }

    const professional = await this.getProfessionalProfileOrThrow(
      professionalProfileId,
    );

    if (professional.utilisateur.id === requestUser.sub) {
      throw appHttpException('MESSAGING_SELF_CONVERSATION_FORBIDDEN');
    }

    return {
      clientUserId: requestUser.sub,
      professionalUserId: professional.utilisateur.id,
      reservationId: null,
    };
  }

  async sendMessage(
    requestUser: AuthUser,
    conversationId: string,
    command: SendConversationMessageCommand,
  ): Promise<SentConversationMessage> {
    const conversation = await this.messagingRepository.findConversationById(
      conversationId,
      requestUser.sub,
    );
    if (!conversation) {
      throw appHttpException('MESSAGING_NOT_FOUND');
    }

    if (
      conversation.clientUserId !== requestUser.sub &&
      conversation.professionalUserId !== requestUser.sub
    ) {
      throw appHttpException('MESSAGING_UNAUTHORIZED');
    }

    const message = ConversationMessageEntity.create({
      id: randomUUID(),
      conversationId,
      senderId: requestUser.sub,
      content: trimString(command.content) ?? null,
      mediaUrl: trimString(command.mediaUrl) ?? null,
    });

    const recipientUserId =
      conversation.clientUserId === requestUser.sub
        ? conversation.professionalUserId
        : conversation.clientUserId;
    const senderName = await this.resolveSenderName(requestUser.sub);

    const createdMessage = await this.messagingRepository.createMessage({
      conversationId: message.conversationId,
      senderId: message.senderId,
      recipientUserId,
      content: message.content,
      mediaUrl: message.mediaUrl,
      notification: {
        type: 'NOUVEAU_MESSAGE',
        title: MESSAGING_NOTIFICATION_MESSAGES.newMessageTitle,
        body: MESSAGING_NOTIFICATION_MESSAGES.newMessageBody({
          senderName,
          content: message.content,
          mediaUrl: message.mediaUrl,
        }),
        data: {
          conversationId,
          senderId: message.senderId,
        },
      },
    });

    await this.notificationDeliveryService.sendPushForNotification(
      createdMessage.notification,
    );

    return {
      message: createdMessage.message,
      recipientUserId,
    };
  }

  private async resolveReservationConversationContext(
    requestUser: AuthUser,
    reservationId: string,
  ): Promise<{
    clientUserId: string;
    professionalUserId: string;
    reservationId: string;
  }> {
    const reservation = await this.getReservationOrThrow(reservationId);
    const professional = await this.getProfessionalProfileOrThrow(
      reservation.professionnelId,
    );

    if (professional.utilisateur.id === reservation.clientId) {
      throw appHttpException('MESSAGING_SELF_CONVERSATION_FORBIDDEN');
    }

    if (requestUser.role === 'CLIENT') {
      if (reservation.clientId !== requestUser.sub) {
        throw appHttpException('MESSAGING_RESERVATION_PARTICIPANTS_MISMATCH');
      }
    } else if (requestUser.role === 'PRESTATAIRE') {
      const connectedProfessional =
        await this.getProfessionalProfileByUserIdOrThrow(requestUser.sub);
      if (connectedProfessional.id !== reservation.professionnelId) {
        throw appHttpException('MESSAGING_RESERVATION_PARTICIPANTS_MISMATCH');
      }
    } else {
      throw appHttpException('MESSAGING_UNAUTHORIZED');
    }

    return {
      clientUserId: reservation.clientId,
      professionalUserId: professional.utilisateur.id,
      reservationId: reservation.id,
    };
  }

  private async resolveSenderName(userId: string): Promise<string> {
    const user = await this.getClientUserOrThrow(userId);
    return user.nom;
  }
}
