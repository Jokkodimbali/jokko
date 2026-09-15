export interface ConversationCounterpart {
  isAdmin?: boolean;
  userId: string;
  professionalProfileId: string | null;
  name: string;
  avatarUrl: string | null;
  subCategoryNames?: string[];
  rating?: number | null;
  reviewCount?: number;
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
  reservationId: string | null;
  lastMessageAt: string | null;
  createdAt: string;
  unreadCount: number;
  counterpart: ConversationCounterpart;
  lastMessage: ConversationLastMessage | null;
}

export interface ConversationMessage {
  id: string;
  conversationId: string;
  disputeId?: string | null;
  senderId: string;
  content: string | null;
  mediaUrl: string | null;
  isRead: boolean;
  createdAt: string;
  sender: {
    isAdmin?: boolean;
    id: string;
    name: string;
    avatarUrl: string | null;
  };
}
