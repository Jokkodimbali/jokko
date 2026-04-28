import { ValidationError } from '../../../shared/domain/errors/domain-error';
import { domainMessage } from '../../../core/messages/domain-message.catalog';

export class MessagingDomainError extends ValidationError {
  constructor(code: string, message: string) {
    super(code, message);
  }

  static messageContentRequired() {
    return new MessagingDomainError(
      'MESSAGING_MESSAGE_CONTENT_REQUIRED',
      domainMessage('MESSAGING_MESSAGE_CONTENT_REQUIRED'),
    );
  }

  static participantsRequired() {
    return new MessagingDomainError(
      'MESSAGING_PARTICIPANTS_REQUIRED',
      domainMessage('MESSAGING_PARTICIPANTS_REQUIRED'),
    );
  }
}
