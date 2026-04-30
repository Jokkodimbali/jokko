import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Server, Socket } from 'socket.io';
import type { AuthUser } from '../../../auth/security/auth-user.type';
import { MessagingFacade } from '../../application/services/messaging-facade.service';
import type { ConversationMessageView } from '../../application/ports/messaging-repository.port';
import { buildSocketCorsOptionsFromProcessEnv } from '../../../core/config/cors.config';

type AuthenticatedSocket = Socket & {
  data: {
    user?: AuthUser;
  };
};

type ConversationReadPayload = {
  conversationId: string;
  readByUserId: string;
  readAt: string;
};

type ConversationTypingPayload = {
  conversationId: string;
  userId: string;
  isTyping: boolean;
  updatedAt: string;
};

@WebSocketGateway({
  namespace: '/socket',
  cors: buildSocketCorsOptionsFromProcessEnv(),
})
export class MessagingGateway implements OnGatewayConnection {
  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly messagingFacade: MessagingFacade,
  ) {}

  async handleConnection(client: AuthenticatedSocket): Promise<void> {
    const token = this.extractToken(client);
    if (!token) {
      client.disconnect();
      return;
    }

    try {
      const user = await this.jwtService.verifyAsync<AuthUser>(token, {
        secret: this.configService.get<string>('JWT_ACCESS_SECRET'),
      });
      this.setSocketUser(client, user);
      await client.join(this.buildUserRoom(user.sub));
    } catch {
      client.disconnect();
    }
  }

  @SubscribeMessage('conversation.join')
  async handleJoinConversation(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: { conversationId: string },
  ) {
    const user = this.getSocketUser(client);
    if (!user) {
      client.disconnect();
      return;
    }

    const openedConversation = await this.messagingFacade.openConversation(
      user,
      payload.conversationId,
      {},
    );
    await client.join(this.buildConversationRoom(payload.conversationId));

    if (openedConversation.markedMessagesCount > 0) {
      this.publishMessagesRead(
        openedConversation.conversation,
        user.sub,
        new Date(),
      );
    }

    return {
      event: 'conversation.history',
      data: openedConversation.messages,
    };
  }

  @SubscribeMessage('conversation.message.send')
  async handleSendMessage(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody()
    payload: { conversationId: string; content?: string; mediaUrl?: string },
  ) {
    const user = this.getSocketUser(client);
    if (!user) {
      client.disconnect();
      return;
    }

    const message = await this.messagingFacade.sendMessage(
      user,
      payload.conversationId,
      {
        content: payload.content,
        mediaUrl: payload.mediaUrl,
      },
    );

    this.publishMessageCreated(message.message, message.recipientUserId);
    return {
      event: 'conversation.message.created',
      data: message.message,
    };
  }

  @SubscribeMessage('conversation.typing')
  async handleTyping(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody()
    payload: { conversationId: string; isTyping: boolean },
  ) {
    const user = this.getSocketUser(client);
    if (!user) {
      client.disconnect();
      return;
    }

    const conversation = await this.messagingFacade.getConversationForUser(
      user,
      payload.conversationId,
    );
    const recipientUserId =
      conversation.clientUserId === user.sub
        ? conversation.professionalUserId
        : conversation.clientUserId;

    const typingPayload: ConversationTypingPayload = {
      conversationId: payload.conversationId,
      userId: user.sub,
      isTyping: payload.isTyping,
      updatedAt: new Date().toISOString(),
    };

    this.server
      .to(this.buildConversationRoom(payload.conversationId))
      .emit('conversation.typing.updated', typingPayload);
    this.server
      .to(this.buildUserRoom(recipientUserId))
      .emit('conversation.typing.updated', typingPayload);

    return {
      event: 'conversation.typing.updated',
      data: typingPayload,
    };
  }

  publishMessageCreated(
    message: ConversationMessageView,
    recipientUserId: string,
  ): void {
    this.server
      .to(this.buildConversationRoom(message.conversationId))
      .emit('conversation.message.created', message);
    this.server
      .to(this.buildUserRoom(recipientUserId))
      .emit('conversation.message.created', message);
  }

  private publishMessagesRead(
    conversation: {
      id: string;
      clientUserId: string;
      professionalUserId: string;
    },
    readByUserId: string,
    readAt: Date,
  ): void {
    const payload: ConversationReadPayload = {
      conversationId: conversation.id,
      readByUserId,
      readAt: readAt.toISOString(),
    };
    const counterpartUserId =
      conversation.clientUserId === readByUserId
        ? conversation.professionalUserId
        : conversation.clientUserId;

    this.server
      .to(this.buildConversationRoom(conversation.id))
      .emit('conversation.messages.read', payload);
    this.server
      .to(this.buildUserRoom(counterpartUserId))
      .emit('conversation.messages.read', payload);
  }

  private extractToken(client: Socket): string | null {
    const authToken =
      typeof client.handshake.auth?.token === 'string'
        ? client.handshake.auth.token
        : null;
    if (authToken) {
      return authToken;
    }

    const authorizationHeader = client.handshake.headers.authorization;
    if (
      typeof authorizationHeader === 'string' &&
      authorizationHeader.startsWith('Bearer ')
    ) {
      return authorizationHeader.slice(7);
    }

    return null;
  }

  private buildUserRoom(userId: string): string {
    return `user:${userId}`;
  }

  private buildConversationRoom(conversationId: string): string {
    return `conversation:${conversationId}`;
  }

  private getSocketUser(client: AuthenticatedSocket): AuthUser | null {
    const socketData = client.data as { user?: AuthUser };
    return socketData.user ?? null;
  }

  private setSocketUser(client: AuthenticatedSocket, user: AuthUser): void {
    const socketData = client.data as { user?: AuthUser };
    socketData.user = user;
  }
}
