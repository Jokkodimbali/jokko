import {
  ValidationError,
  ConflictError,
  NotFoundError,
} from '../../../shared/domain/errors/domain-error';
import { domainMessage } from '../../../core/messages/domain-message.catalog';

export class UserDomainError extends ValidationError {
  constructor(code: string, message: string) {
    super(code, message);
  }

  static userNotFound(): NotFoundError {
    return new NotFoundError('USER_NOT_FOUND', domainMessage('USER_NOT_FOUND'));
  }

  static userAlreadyExists(identifier: string): ConflictError {
    return new ConflictError(
      'USER_ALREADY_EXISTS',
      domainMessage('USER_ALREADY_EXISTS', { identifier }),
    );
  }

  static userNotActive(): ValidationError {
    return new ValidationError(
      'USER_NOT_ACTIVE',
      domainMessage('USER_NOT_ACTIVE'),
    );
  }

  static userAlreadyDeactivated(): ConflictError {
    return new ConflictError(
      'USER_ALREADY_DEACTIVATED',
      domainMessage('USER_ALREADY_DEACTIVATED'),
    );
  }

  static invalidEmail(email: string): ValidationError {
    return new ValidationError(
      'INVALID_EMAIL',
      domainMessage('INVALID_EMAIL', { email }),
    );
  }

  static emailAlreadyUsed(email: string): ConflictError {
    return new ConflictError(
      'EMAIL_ALREADY_USED',
      domainMessage('EMAIL_ALREADY_USED', { email }),
    );
  }

  static invalidName(name: string): ValidationError {
    return new ValidationError(
      'INVALID_NAME',
      domainMessage('INVALID_NAME', { name }),
    );
  }

  static invalidAddress(): ValidationError {
    return new ValidationError(
      'INVALID_ADDRESS',
      domainMessage('INVALID_ADDRESS'),
    );
  }

  static cannotDeleteActiveUser(): ValidationError {
    return new ValidationError(
      'CANNOT_DELETE_ACTIVE_USER',
      domainMessage('CANNOT_DELETE_ACTIVE_USER'),
    );
  }
}
