import { Inject, Injectable } from '@nestjs/common';
import type { AuthUser } from '../../../auth/security/auth-user.type';
import { appHttpException } from '../../../core/http/app-http.exception';
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
  ListConversationMessagesQuery,
  ListConversationsQuery,
} from '../commands/messaging.commands';
import {
  MESSAGING_REPOSITORY_PORT,
  type MessagingRepositoryPort,
} from '../ports/messaging-repository.port';
import { MessagingAppService } from './messaging-app-service.base';

@Injectable()
export class MessagingQueryService extends MessagingAppService {
  constructor(
    @Inject(MESSAGING_REPOSITORY_PORT)
    messagingRepository: MessagingRepositoryPort,
    @Inject(USERS_REPOSITORY_PORT)
    usersRepository: UsersRepositoryPort,
    @Inject(PROFESSIONALS_REPOSITORY_PORT)
    professionalsRepository: ProfessionalsRepositoryPort,
    @Inject(RESERVATIONS_REPOSITORY_PORT)
    reservationsRepository: ReservationsRepositoryPort,
  ) {
    super(
      messagingRepository,
      usersRepository,
      professionalsRepository,
      reservationsRepository,
    );
  }

  async listConversations(
    requestUser: AuthUser,
    query: ListConversationsQuery,
  ) {
    return this.messagingRepository.listConversationsForUser({
      userId: requestUser.sub,
      limit: this.normalizeLimit(query.limit),
      offset: this.normalizeOffset(query.offset),
    });
  }

  async listMessages(
    requestUser: AuthUser,
    conversationId: string,
    query: ListConversationMessagesQuery,
  ) {
    const openedConversation = await this.openConversation(
      requestUser,
      conversationId,
      query,
    );

    return openedConversation.messages;
  }

  async getConversationForUser(requestUser: AuthUser, conversationId: string) {
    const conversation = await this.messagingRepository.findConversationById(
      conversationId,
      requestUser.sub,
    );
    if (!conversation) {
      throw appHttpException('MESSAGING_NOT_FOUND');
    }

    return conversation;
  }

  async openConversation(
    requestUser: AuthUser,
    conversationId: string,
    query: ListConversationMessagesQuery,
  ) {
    const conversation = await this.getConversationForUser(
      requestUser,
      conversationId,
    );

    const markedMessagesCount =
      await this.messagingRepository.markMessagesAsRead(
        conversationId,
        requestUser.sub,
      );

    const messages = await this.messagingRepository.listMessages({
      conversationId,
      limit: this.normalizeLimit(query.limit),
      offset: this.normalizeOffset(query.offset),
    });

    return {
      conversation,
      messages,
      markedMessagesCount,
    };
  }
}
