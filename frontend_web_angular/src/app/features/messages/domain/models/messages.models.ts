export interface ConversationCounterpart {
  userId: string;
  professionalProfileId: string | null;
  name: string;
  avatarUrl: string | null;
}

export interface ConversationLastMessage {
  id: string;
  senderId: string;
  content: string | null;
  mediaUrl: string | null;
  createdAt: string;
}

export interface Conversation {
  id: string;
  clientUserId: string;
  professionalUserId: string;
  professionalProfileId: string | null;
  reservationId: string;
  lastMessageAt: string | null;
  createdAt: string;
  unreadCount: number;
  counterpart: ConversationCounterpart;
  lastMessage: ConversationLastMessage | null;
}

export interface ConversationMessage {
  id: string;
  conversationId: string;
  senderId: string;
  content: string | null;
  mediaUrl: string | null;
  isRead: boolean;
  createdAt: string;
  sender: {
    id: string;
    name: string;
    avatarUrl: string | null;
  };
}
