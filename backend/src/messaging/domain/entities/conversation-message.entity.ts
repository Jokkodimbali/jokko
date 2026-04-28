import { MessagingDomainError } from '../errors/messaging.domain-error';

export class ConversationMessageEntity {
  private constructor(
    readonly id: string,
    readonly conversationId: string,
    readonly senderId: string,
    readonly content: string | null,
    readonly mediaUrl: string | null,
  ) {}

  static create(input: {
    id: string;
    conversationId: string;
    senderId: string;
    content?: string | null;
    mediaUrl?: string | null;
  }) {
    const content =
      input.content && input.content.trim().length > 0
        ? input.content.trim()
        : null;
    const mediaUrl =
      input.mediaUrl && input.mediaUrl.trim().length > 0
        ? input.mediaUrl.trim()
        : null;

    if (!content && !mediaUrl) {
      throw MessagingDomainError.messageContentRequired();
    }

    return new ConversationMessageEntity(
      input.id,
      input.conversationId,
      input.senderId,
      content,
      mediaUrl,
    );
  }
}
