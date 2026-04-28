import { MessagingDomainError } from '../errors/messaging.domain-error';

export class ConversationEntity {
  private constructor(
    readonly id: string,
    readonly clientUserId: string,
    readonly professionalUserId: string,
    readonly reservationId: string,
  ) {}

  static create(input: {
    id: string;
    clientUserId: string;
    professionalUserId: string;
    reservationId: string;
  }) {
    if (
      input.clientUserId.trim().length === 0 ||
      input.professionalUserId.trim().length === 0 ||
      input.reservationId.trim().length === 0
    ) {
      throw MessagingDomainError.participantsRequired();
    }

    return new ConversationEntity(
      input.id,
      input.clientUserId,
      input.professionalUserId,
      input.reservationId,
    );
  }
}
