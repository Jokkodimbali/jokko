import {
  ValidationError,
  ConflictError,
} from '../../../shared/domain/errors/domain-error';

export class ReservationDomainError extends ValidationError {
  constructor(code: string, message: string) {
    super(code, message);
  }

  static clientRequired(): ReservationDomainError {
    return new ReservationDomainError(
      'RESERVATION_CLIENT_REQUIRED',
      'Le client est requis',
    );
  }

  static professionalRequired(): ReservationDomainError {
    return new ReservationDomainError(
      'RESERVATION_PROFESSIONAL_REQUIRED',
      'Le professionnel est requis',
    );
  }

  static serviceRequired(): ReservationDomainError {
    return new ReservationDomainError(
      'RESERVATION_SERVICE_REQUIRED',
      'Le service est requis',
    );
  }

  static pastDateTime(): ReservationDomainError {
    return new ReservationDomainError(
      'RESERVATION_PAST_DATETIME',
      'La date et heure doit être dans le futur',
    );
  }

  static notPending(): ReservationDomainError {
    return new ReservationDomainError(
      'RESERVATION_NOT_PENDING',
      'La réservation doit être en attente',
    );
  }

  static notConfirmed(): ReservationDomainError {
    return new ReservationDomainError(
      'RESERVATION_NOT_CONFIRMED',
      'La réservation doit être confirmée',
    );
  }

  static alreadyClosed(): ReservationDomainError {
    return new ReservationDomainError(
      'RESERVATION_ALREADY_CLOSED',
      'La réservation est déjà terminée ou annulée',
    );
  }

  static cannotReschedule(): ReservationDomainError {
    return new ReservationDomainError(
      'RESERVATION_CANNOT_RESCHEDULE',
      'Impossible de reprogrammer cette réservation',
    );
  }

  static notFound(): ReservationDomainError {
    return new ReservationDomainError(
      'RESERVATION_NOT_FOUND',
      'Réservation non trouvée',
    );
  }

  static unauthorized(): ReservationDomainError {
    return new ReservationDomainError(
      'RESERVATION_UNAUTHORIZED',
      "Vous n'êtes pas autorisé à modifier cette réservation",
    );
  }

  static timeSlotUnavailable(): ConflictError {
    return new ConflictError(
      'RESERVATION_TIME_SLOT_UNAVAILABLE',
      "Ce créneau horaire n'est pas disponible",
    );
  }
}
