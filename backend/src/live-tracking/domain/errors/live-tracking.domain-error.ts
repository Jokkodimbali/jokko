import {
  ConflictError,
  ValidationError,
} from '../../../shared/domain/errors/domain-error';
import { domainMessage } from '../../../core/messages/domain-message.catalog';

export class LiveTrackingDomainError {
  static invalidOnTheWayStatus(): ConflictError {
    return new ConflictError(
      'LIVE_TRACKING_INVALID_RESERVATION_STATUS',
      domainMessage('LIVE_TRACKING_INVALID_ON_THE_WAY_STATUS'),
    );
  }

  static activeSessionRequired(): ConflictError {
    return new ConflictError(
      'LIVE_TRACKING_ACTIVE_SESSION_REQUIRED',
      domainMessage('LIVE_TRACKING_ACTIVE_SESSION_REQUIRED'),
    );
  }

  static anotherTripActive(): ConflictError {
    return new ConflictError(
      'LIVE_TRACKING_ANOTHER_TRIP_ACTIVE',
      domainMessage('LIVE_TRACKING_ANOTHER_TRIP_ACTIVE'),
    );
  }

  static invalidLocation(): ValidationError {
    return new ValidationError(
      'LIVE_TRACKING_INVALID_LOCATION',
      domainMessage('LIVE_TRACKING_INVALID_LOCATION'),
    );
  }
}
