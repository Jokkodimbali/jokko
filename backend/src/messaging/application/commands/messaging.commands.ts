export type CreateConversationCommand = {
  reservationId?: string;
  professionalProfileId?: string;
};

export type SendConversationMessageCommand = {
  content?: string;
  mediaUrl?: string;
};

export type ListConversationsQuery = {
  limit?: number;
  offset?: number;
};

export type ListConversationMessagesQuery = {
  limit?: number;
  offset?: number;
};
