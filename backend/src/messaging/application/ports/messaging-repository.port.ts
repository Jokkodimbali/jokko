import type {
  NotificationMetadata,
  NotificationView,
} from '../../../notifications/domain/entities/notification.entity';

export const MESSAGING_REPOSITORY_PORT = Symbol('MESSAGING_REPOSITORY_PORT');

export type ConversationCounterpartView = {
  userId: string;
  professionalProfileId: string | null;
  name: string;
  avatarUrl: string | null;
};

export type ConversationLastMessageView = {
  id: string;
  senderId: string;
  content: string | null;
  mediaUrl: string | null;
  createdAt: Date;
};

export type ConversationView = {
  id: string;
  clientUserId: string;
  professionalUserId: string;
  professionalProfileId: string | null;
  reservationId: string | null;
  lastMessageAt: Date | null;
  createdAt: Date;
  unreadCount: number;
  counterpart: ConversationCounterpartView;
  lastMessage: ConversationLastMessageView | null;
};

export type ConversationMessageView = {
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

export type CreateConversationInput = {
  clientUserId: string;
  professionalUserId: string;
  reservationId?: string | null;
};

export type CreateConversationResult = {
  conversation: ConversationView;
  wasCreated: boolean;
};

export type CreateConversationMessageInput = {
  conversationId: string;
  senderId: string;
  recipientUserId: string;
  content: string | null;
  mediaUrl: string | null;
  notification: {
    type: 'NOUVEAU_MESSAGE';
    title: string;
    body: string;
    data: NotificationMetadata;
  };
};

export type CreateConversationMessageResult = {
  message: ConversationMessageView;
  notification: NotificationView;
};

export interface MessagingRepositoryPort {
  listConversationsForUser(params: {
    userId: string;
    limit: number;
    offset: number;
  }): Promise<ConversationView[]>;
  findConversationById(
    conversationId: string,
    currentUserId: string,
  ): Promise<ConversationView | null>;
  findConversationByReservationId(
    reservationId: string,
    currentUserId: string,
  ): Promise<ConversationView | null>;
  findDirectConversationByParticipants(params: {
    clientUserId: string;
    professionalUserId: string;
    currentUserId: string;
  }): Promise<ConversationView | null>;
  createConversation(
    input: CreateConversationInput,
    currentUserId: string,
  ): Promise<CreateConversationResult>;
  listMessages(params: {
    conversationId: string;
    limit: number;
    offset: number;
  }): Promise<ConversationMessageView[]>;
  markMessagesAsRead(
    conversationId: string,
    currentUserId: string,
  ): Promise<number>;
  createMessage(
    input: CreateConversationMessageInput,
  ): Promise<CreateConversationMessageResult>;
}
