import { ValidationError } from '../../../shared/domain/errors/domain-error';
import { domainMessage } from '../../../core/messages/domain-message.catalog';

export class ReservationDomainError extends ValidationError {
  constructor(code: string, message: string) {
    super(code, message);
  }

  static clientRequired(): ReservationDomainError {
    return new ReservationDomainError(
      'RESERVATION_CLIENT_REQUIRED',
      domainMessage('RESERVATION_CLIENT_REQUIRED'),
    );
  }

  static professionalRequired(): ReservationDomainError {
    return new ReservationDomainError(
      'RESERVATION_PROFESSIONAL_REQUIRED',
      domainMessage('RESERVATION_PROFESSIONAL_REQUIRED'),
    );
  }

  static serviceRequired(): ReservationDomainError {
    return new ReservationDomainError(
      'RESERVATION_SERVICE_REQUIRED',
      domainMessage('RESERVATION_SERVICE_REQUIRED'),
    );
  }

  static addressRequired(): ReservationDomainError {
    return new ReservationDomainError(
      'RESERVATION_ADDRESS_REQUIRED',
      domainMessage('RESERVATION_ADDRESS_REQUIRED'),
    );
  }

  static invalidDuration(): ReservationDomainError {
    return new ReservationDomainError(
      'RESERVATION_INVALID_DURATION',
      domainMessage('RESERVATION_INVALID_DURATION'),
    );
  }

  static invalidDateTime(): ReservationDomainError {
    return new ReservationDomainError(
      'RESERVATION_INVALID_DATETIME',
      domainMessage('RESERVATION_INVALID_DATETIME'),
    );
  }

  static pastDateTime(): ReservationDomainError {
    return new ReservationDomainError(
      'RESERVATION_PAST_DATETIME',
      domainMessage('RESERVATION_PAST_DATETIME'),
    );
  }

  static notPending(): ReservationDomainError {
    return new ReservationDomainError(
      'RESERVATION_NOT_PENDING',
      domainMessage('RESERVATION_NOT_PENDING'),
    );
  }

  static notActive(): ReservationDomainError {
    return new ReservationDomainError(
      'RESERVATION_NOT_ACTIVE',
      domainMessage('RESERVATION_NOT_ACTIVE'),
    );
  }

  static notConfirmed(): ReservationDomainError {
    return new ReservationDomainError(
      'RESERVATION_NOT_CONFIRMED',
      domainMessage('RESERVATION_NOT_CONFIRMED'),
    );
  }

  static alreadyClosed(): ReservationDomainError {
    return new ReservationDomainError(
      'RESERVATION_ALREADY_CLOSED',
      domainMessage('RESERVATION_ALREADY_CLOSED'),
    );
  }

  static cannotReschedule(): ReservationDomainError {
    return new ReservationDomainError(
      'RESERVATION_CANNOT_RESCHEDULE',
      domainMessage('RESERVATION_CANNOT_RESCHEDULE'),
    );
  }

  static cannotCancel(): ReservationDomainError {
    return new ReservationDomainError(
      'RESERVATION_CANNOT_CANCEL',
      domainMessage('RESERVATION_CANNOT_CANCEL'),
    );
  }

  static notFound(): ReservationDomainError {
    return new ReservationDomainError(
      'RESERVATION_NOT_FOUND',
      domainMessage('RESERVATION_NOT_FOUND'),
    );
  }

  static unauthorized(): ReservationDomainError {
    return new ReservationDomainError(
      'RESERVATION_UNAUTHORIZED',
      domainMessage('RESERVATION_UNAUTHORIZED'),
    );
  }

  static timeSlotUnavailable(): ReservationDomainError {
    return new ReservationDomainError(
      'RESERVATION_TIME_SLOT_UNAVAILABLE',
      domainMessage('RESERVATION_TIME_SLOT_UNAVAILABLE'),
    );
  }

  static cannotMarkAsPaid(): ReservationDomainError {
    return new ReservationDomainError(
      'RESERVATION_CANNOT_MARK_AS_PAID',
      domainMessage('RESERVATION_CANNOT_MARK_AS_PAID'),
    );
  }

  static cannotStart(): ReservationDomainError {
    return new ReservationDomainError(
      'RESERVATION_CANNOT_START',
      domainMessage('RESERVATION_CANNOT_START'),
    );
  }

  static paymentRequired(): ReservationDomainError {
    return new ReservationDomainError(
      'RESERVATION_PAYMENT_REQUIRED',
      domainMessage('RESERVATION_PAYMENT_REQUIRED'),
    );
  }

  static invalidPriceAdjustmentStatus(): ReservationDomainError {
    return new ReservationDomainError(
      'RESERVATION_PRICE_ADJUSTMENT_STATUS_INVALID',
      domainMessage('RESERVATION_PRICE_ADJUSTMENT_STATUS_INVALID'),
    );
  }

  static priceAdjustmentAlreadyPending(): ReservationDomainError {
    return new ReservationDomainError(
      'RESERVATION_PRICE_ADJUSTMENT_ALREADY_PENDING',
      domainMessage('RESERVATION_PRICE_ADJUSTMENT_ALREADY_PENDING'),
    );
  }

  static priceAdjustmentNotPending(): ReservationDomainError {
    return new ReservationDomainError(
      'RESERVATION_PRICE_ADJUSTMENT_NOT_PENDING',
      domainMessage('RESERVATION_PRICE_ADJUSTMENT_NOT_PENDING'),
    );
  }

  static invalidPriceAdjustmentAmount(): ReservationDomainError {
    return new ReservationDomainError(
      'RESERVATION_PRICE_ADJUSTMENT_AMOUNT_INVALID',
      domainMessage('RESERVATION_PRICE_ADJUSTMENT_AMOUNT_INVALID'),
    );
  }

  static unchangedPriceAdjustmentAmount(): ReservationDomainError {
    return new ReservationDomainError(
      'RESERVATION_PRICE_ADJUSTMENT_AMOUNT_UNCHANGED',
      domainMessage('RESERVATION_PRICE_ADJUSTMENT_AMOUNT_UNCHANGED'),
    );
  }

  static paymentAlreadyExistsForPriceAdjustment(): ReservationDomainError {
    return new ReservationDomainError(
      'RESERVATION_PRICE_ADJUSTMENT_PAYMENT_ALREADY_EXISTS',
      domainMessage('RESERVATION_PRICE_ADJUSTMENT_PAYMENT_ALREADY_EXISTS'),
    );
  }

  static cannotOpenDispute(): ReservationDomainError {
    return new ReservationDomainError(
      'RESERVATION_CANNOT_OPEN_DISPUTE',
      domainMessage('RESERVATION_CANNOT_OPEN_DISPUTE'),
    );
  }

  static cancellationTooLate(): ReservationDomainError {
    return new ReservationDomainError(
      'RESERVATION_CANCELLATION_TOO_LATE',
      domainMessage('RESERVATION_CANCELLATION_TOO_LATE'),
    );
  }

  static rescheduleTooLate(): ReservationDomainError {
    return new ReservationDomainError(
      'RESERVATION_RESCHEDULE_TOO_LATE',
      domainMessage('RESERVATION_RESCHEDULE_TOO_LATE'),
    );
  }
}
