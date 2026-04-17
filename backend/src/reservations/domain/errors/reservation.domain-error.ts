import {
  type DomainError,
  ConflictError,
  NotFoundError,
  ValidationError,
} from '../../../shared/domain/errors/domain-error';

export class ReservationDomainError {
  static clientRequired(): ValidationError {
    return new ValidationError(
      'RESERVATION_CLIENT_REQUIRED',
      'Le client est obligatoire.',
    );
  }

  static professionalRequired(): ValidationError {
    return new ValidationError(
      'RESERVATION_PROFESSIONAL_REQUIRED',
      'Le professionnel est obligatoire.',
    );
  }

  static serviceRequired(): ValidationError {
    return new ValidationError(
      'RESERVATION_SERVICE_REQUIRED',
      'Le service est obligatoire.',
    );
  }

  static addressRequired(): ValidationError {
    return new ValidationError(
      'RESERVATION_ADDRESS_REQUIRED',
      "L'adresse du client est obligatoire.",
    );
  }

  static invalidDuration(): ValidationError {
    return new ValidationError(
      'RESERVATION_INVALID_DURATION',
      'La duree de reservation est invalide.',
    );
  }

  static invalidDateTime(): ValidationError {
    return new ValidationError(
      'RESERVATION_INVALID_DATETIME',
      'La date et l heure de reservation sont invalides.',
    );
  }

  static pastDateTime(): ValidationError {
    return new ValidationError(
      'RESERVATION_PAST_DATETIME',
      'La date et l heure doivent etre dans le futur.',
    );
  }

  static notPending(): ConflictError {
    return new ConflictError(
      'RESERVATION_NOT_PENDING',
      'La reservation doit etre en attente.',
    );
  }

  static notActive(): ConflictError {
    return new ConflictError(
      'RESERVATION_NOT_ACTIVE',
      'La reservation doit etre confirmee ou en cours.',
    );
  }

  static alreadyClosed(): ConflictError {
    return new ConflictError(
      'RESERVATION_ALREADY_CLOSED',
      'La reservation est deja terminee ou annulee.',
    );
  }

  static cannotReschedule(): ConflictError {
    return new ConflictError(
      'RESERVATION_CANNOT_RESCHEDULE',
      'Impossible de reprogrammer cette reservation.',
    );
  }

  static cannotCancel(): ConflictError {
    return new ConflictError(
      'RESERVATION_CANNOT_CANCEL',
      'Impossible d annuler cette reservation dans son statut actuel.',
    );
  }

  static notFound(): NotFoundError {
    return new NotFoundError(
      'RESERVATION_NOT_FOUND',
      'Reservation introuvable.',
    );
  }

  static unauthorized(): DomainError {
    return new ConflictError(
      'RESERVATION_UNAUTHORIZED',
      "Vous n'etes pas autorise a modifier cette reservation.",
    );
  }

  static timeSlotUnavailable(): ConflictError {
    return new ConflictError(
      'RESERVATION_TIME_SLOT_UNAVAILABLE',
      'Ce creneau horaire n est pas disponible.',
    );
  }
}
