import { Injectable } from '@nestjs/common';
import type { AuthUser } from '../../../auth/security/auth-user.type';
import type {
  CreateConversationCommand,
  ListConversationMessagesQuery,
  ListConversationsQuery,
  SendConversationMessageCommand,
} from '../commands/messaging.commands';
import { MessagingCommandService } from './messaging-command.service';
import { MessagingQueryService } from './messaging-query.service';

@Injectable()
export class MessagingFacade {
  constructor(
    private readonly messagingCommandService: MessagingCommandService,
    private readonly messagingQueryService: MessagingQueryService,
  ) {}

  async listConversations(
    requestUser: AuthUser,
    query: ListConversationsQuery,
  ) {
    return this.messagingQueryService.listConversations(requestUser, query);
  }

  async createConversation(
    requestUser: AuthUser,
    command: CreateConversationCommand,
  ) {
    return this.messagingCommandService.createConversation(
      requestUser,
      command,
    );
  }

  async listMessages(
    requestUser: AuthUser,
    conversationId: string,
    query: ListConversationMessagesQuery,
  ) {
    return this.messagingQueryService.listMessages(
      requestUser,
      conversationId,
      query,
    );
  }

  async getConversationForUser(requestUser: AuthUser, conversationId: string) {
    return this.messagingQueryService.getConversationForUser(
      requestUser,
      conversationId,
    );
  }

  async openConversation(
    requestUser: AuthUser,
    conversationId: string,
    query: ListConversationMessagesQuery,
  ) {
    return this.messagingQueryService.openConversation(
      requestUser,
      conversationId,
      query,
    );
  }

  async sendMessage(
    requestUser: AuthUser,
    conversationId: string,
    command: SendConversationMessageCommand,
  ) {
    return this.messagingCommandService.sendMessage(
      requestUser,
      conversationId,
      command,
    );
  }
}
