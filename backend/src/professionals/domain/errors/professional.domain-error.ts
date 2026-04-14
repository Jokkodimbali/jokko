import {
  ValidationError,
  ConflictError,
  NotFoundError,
} from '../../../shared/domain/errors/domain-error';

export class ProfessionalDomainError extends ValidationError {
  constructor(code: string, message: string) {
    super(code, message);
  }

  static invalidBioLength(length: number): ProfessionalDomainError {
    return new ProfessionalDomainError(
      'INVALID_BIO_LENGTH',
      `Bio length must be between 1 and 1000 characters. Got: ${length}`,
    );
  }

  static invalidCompanyNameLength(length: number): ProfessionalDomainError {
    return new ProfessionalDomainError(
      'INVALID_COMPANY_NAME_LENGTH',
      `Company name length must be between 1 and 150 characters. Got: ${length}`,
    );
  }

  static invalidCityLength(length: number): ProfessionalDomainError {
    return new ProfessionalDomainError(
      'INVALID_CITY_LENGTH',
      `City length must be between 1 and 100 characters. Got: ${length}`,
    );
  }

  static invalidKycUrl(url: string): ProfessionalDomainError {
    return new ProfessionalDomainError(
      'INVALID_KYC_URL',
      `Invalid KYC ID card URL format: ${url}`,
    );
  }

  static invalidTimeFormat(time: string): ProfessionalDomainError {
    return new ProfessionalDomainError(
      'INVALID_TIME_FORMAT',
      `Invalid time format, expected HH:mm: ${time}`,
    );
  }

  static invalidDayOfWeek(day: number): ProfessionalDomainError {
    return new ProfessionalDomainError(
      'INVALID_DAY_OF_WEEK',
      `Day of week must be between 0 and 6. Got: ${day}`,
    );
  }

  static profileNotFound(profileId: string): NotFoundError {
    return new NotFoundError(
      'PROFILE_NOT_FOUND',
      `Profile not found: ${profileId}`,
    );
  }

  static profileAlreadyExists(userId: string): ConflictError {
    return new ConflictError(
      'PROFILE_ALREADY_EXISTS',
      `Profile already exists for user: ${userId}`,
    );
  }

  static invalidRating(rating: number): ProfessionalDomainError {
    return new ProfessionalDomainError(
      'INVALID_RATING',
      `Rating must be between 0 and 5. Got: ${rating}`,
    );
  }

  static kycAlreadySubmitted(): ConflictError {
    return new ConflictError(
      'KYC_ALREADY_SUBMITTED',
      'KYC has already been submitted and is pending or verified',
    );
  }

  static kycNotSubmitted(): ValidationError {
    return new ValidationError(
      'KYC_NOT_SUBMITTED',
      'KYC must be submitted before it can be approved or rejected',
    );
  }

  static rejectReasonEmpty(): ValidationError {
    return new ValidationError(
      'REJECT_REASON_EMPTY',
      'Le motif de rejet ne peut pas etre vide',
    );
  }

  static invalidRole(role: string): ValidationError {
    return new ValidationError('INVALID_ROLE', `Role invalide : ${role}`);
  }
}
