import {
  ValidationError,
  ConflictError,
  NotFoundError,
} from '../../../shared/domain/errors/domain-error';
import { domainMessage } from '../../../core/messages/domain-message.catalog';

export class ProfessionalDomainError extends ValidationError {
  constructor(code: string, message: string) {
    super(code, message);
  }

  static invalidBioLength(length: number): ProfessionalDomainError {
    return new ProfessionalDomainError(
      'INVALID_BIO_LENGTH',
      domainMessage('INVALID_BIO_LENGTH', { length }),
    );
  }

  static invalidCompanyNameLength(length: number): ProfessionalDomainError {
    return new ProfessionalDomainError(
      'INVALID_COMPANY_NAME_LENGTH',
      domainMessage('INVALID_COMPANY_NAME_LENGTH', { length }),
    );
  }

  static invalidCityLength(length: number): ProfessionalDomainError {
    return new ProfessionalDomainError(
      'INVALID_CITY_LENGTH',
      domainMessage('INVALID_CITY_LENGTH', { length }),
    );
  }

  static invalidKycUrl(url: string): ProfessionalDomainError {
    return new ProfessionalDomainError(
      'INVALID_KYC_URL',
      domainMessage('INVALID_KYC_URL', { url }),
    );
  }

  static invalidTimeFormat(time: string): ProfessionalDomainError {
    return new ProfessionalDomainError(
      'INVALID_TIME_FORMAT',
      domainMessage('INVALID_TIME_FORMAT', { time }),
    );
  }

  static invalidDayOfWeek(day: number): ProfessionalDomainError {
    return new ProfessionalDomainError(
      'INVALID_DAY_OF_WEEK',
      domainMessage('INVALID_DAY_OF_WEEK', { day }),
    );
  }

  static profileNotFound(profileId: string): NotFoundError {
    return new NotFoundError(
      'PROFILE_NOT_FOUND',
      domainMessage('PROFILE_NOT_FOUND', { profileId }),
    );
  }

  static profileAlreadyExists(userId: string): ConflictError {
    return new ConflictError(
      'PROFILE_ALREADY_EXISTS',
      domainMessage('PROFILE_ALREADY_EXISTS', { userId }),
    );
  }

  static invalidRating(rating: number): ProfessionalDomainError {
    return new ProfessionalDomainError(
      'INVALID_RATING',
      domainMessage('INVALID_RATING', { rating }),
    );
  }

  static kycAlreadySubmitted(): ConflictError {
    return new ConflictError(
      'KYC_ALREADY_SUBMITTED',
      domainMessage('KYC_ALREADY_SUBMITTED'),
    );
  }

  static kycNotSubmitted(): ValidationError {
    return new ValidationError(
      'KYC_NOT_SUBMITTED',
      domainMessage('KYC_NOT_SUBMITTED'),
    );
  }

  static rejectReasonEmpty(): ValidationError {
    return new ValidationError(
      'REJECT_REASON_EMPTY',
      domainMessage('REJECT_REASON_EMPTY'),
    );
  }

  static invalidRole(role: string): ValidationError {
    return new ValidationError(
      'INVALID_ROLE',
      domainMessage('INVALID_ROLE', { role }),
    );
  }
}
