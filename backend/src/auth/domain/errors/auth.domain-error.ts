import {
  ValidationError,
  ConflictError,
} from '../../../shared/domain/errors/domain-error';

export class AuthDomainError extends ValidationError {
  constructor(code: string, message: string) {
    super(code, message);
  }

  static passwordRequired(): ValidationError {
    return new ValidationError(
      'PASSWORD_REQUIRED',
      'Le mot de passe est obligatoire',
    );
  }

  static passwordTooShort(length: number): ValidationError {
    return new ValidationError(
      'PASSWORD_TOO_SHORT',
      `Le mot de passe doit contenir au moins 8 caractères (actuellement ${length})`,
    );
  }

  static passwordTooLong(length: number): ValidationError {
    return new ValidationError(
      'PASSWORD_TOO_LONG',
      `Le mot de passe ne doit pas dépasser 64 caractères (actuellement ${length})`,
    );
  }

  static invalidPhoneNumber(phoneNumber: string): ValidationError {
    return new ValidationError(
      'PHONE_INVALID',
      `Le numéro de téléphone ${phoneNumber} est invalide`,
    );
  }

  static otpInvalidOrExpired(): ValidationError {
    return new ValidationError(
      'OTP_INVALID_OR_EXPIRED',
      'Le code OTP est invalide ou a expiré',
    );
  }

  static otpTooManyRequests(): ValidationError {
    return new ValidationError(
      'OTP_TOO_MANY_REQUESTS',
      'Trop de tentatives OTP. Veuillez réessayer plus tard.',
    );
  }

  static otpResendTooEarly(): ConflictError {
    return new ConflictError(
      'OTP_RESEND_TOO_EARLY',
      'Veuillez attendre avant de redemander un code OTP.',
    );
  }
}
