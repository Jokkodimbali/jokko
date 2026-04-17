import {
  type DomainError,
  ConflictError,
  NotFoundError,
  ValidationError,
} from '../../../shared/domain/errors/domain-error';
import { domainMessage } from '../../../core/messages/domain-message.catalog';

export class ReservationDomainError {
  static clientRequired(): ValidationError {
    return new ValidationError(
      'RESERVATION_CLIENT_REQUIRED',
      domainMessage('RESERVATION_CLIENT_REQUIRED'),
    );
  }

  static professionalRequired(): ValidationError {
    return new ValidationError(
      'RESERVATION_PROFESSIONAL_REQUIRED',
      domainMessage('RESERVATION_PROFESSIONAL_REQUIRED'),
    );
  }

  static serviceRequired(): ValidationError {
    return new ValidationError(
      'RESERVATION_SERVICE_REQUIRED',
      domainMessage('RESERVATION_SERVICE_REQUIRED'),
    );
  }

  static addressRequired(): ValidationError {
    return new ValidationError(
      'RESERVATION_ADDRESS_REQUIRED',
      domainMessage('RESERVATION_ADDRESS_REQUIRED'),
    );
  }

  static invalidDuration(): ValidationError {
    return new ValidationError(
      'RESERVATION_INVALID_DURATION',
      domainMessage('RESERVATION_INVALID_DURATION'),
    );
  }

  static invalidDateTime(): ValidationError {
    return new ValidationError(
      'RESERVATION_INVALID_DATETIME',
      domainMessage('RESERVATION_INVALID_DATETIME'),
    );
  }

  static pastDateTime(): ValidationError {
    return new ValidationError(
      'RESERVATION_PAST_DATETIME',
      domainMessage('RESERVATION_PAST_DATETIME'),
    );
  }

  static notPending(): ConflictError {
    return new ConflictError(
      'RESERVATION_NOT_PENDING',
      domainMessage('RESERVATION_NOT_PENDING'),
    );
  }

  static notActive(): ConflictError {
    return new ConflictError(
      'RESERVATION_NOT_ACTIVE',
      domainMessage('RESERVATION_NOT_ACTIVE'),
    );
  }

  static alreadyClosed(): ConflictError {
    return new ConflictError(
      'RESERVATION_ALREADY_CLOSED',
      domainMessage('RESERVATION_ALREADY_CLOSED'),
    );
  }

  static cannotReschedule(): ConflictError {
    return new ConflictError(
      'RESERVATION_CANNOT_RESCHEDULE',
      domainMessage('RESERVATION_CANNOT_RESCHEDULE'),
    );
  }

  static cannotCancel(): ConflictError {
    return new ConflictError(
      'RESERVATION_CANNOT_CANCEL',
      domainMessage('RESERVATION_CANNOT_CANCEL'),
    );
  }

  static notFound(): NotFoundError {
    return new NotFoundError(
      'RESERVATION_NOT_FOUND',
      domainMessage('RESERVATION_NOT_FOUND'),
    );
  }

  static unauthorized(): DomainError {
    return new ConflictError(
      'RESERVATION_UNAUTHORIZED',
      domainMessage('RESERVATION_UNAUTHORIZED'),
    );
  }

  static timeSlotUnavailable(): ConflictError {
    return new ConflictError(
      'RESERVATION_TIME_SLOT_UNAVAILABLE',
      domainMessage('RESERVATION_TIME_SLOT_UNAVAILABLE'),
    );
  }
}
