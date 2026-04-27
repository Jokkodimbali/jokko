import {
  ValidationError,
  ConflictError,
} from '../../../shared/domain/errors/domain-error';
import { domainMessage } from '../../../core/messages/domain-message.catalog';

export class AuthDomainError extends ValidationError {
  constructor(code: string, message: string) {
    super(code, message);
  }

  static passwordRequired(): ValidationError {
    return new ValidationError(
      'PASSWORD_REQUIRED',
      domainMessage('PASSWORD_REQUIRED'),
    );
  }

  static passwordTooShort(length: number): ValidationError {
    return new ValidationError(
      'PASSWORD_TOO_SHORT',
      domainMessage('PASSWORD_TOO_SHORT', { length }),
    );
  }

  static passwordTooLong(length: number): ValidationError {
    return new ValidationError(
      'PASSWORD_TOO_LONG',
      domainMessage('PASSWORD_TOO_LONG', { length }),
    );
  }

  static invalidPhoneNumber(phoneNumber: string): ValidationError {
    return new ValidationError(
      'PHONE_INVALID',
      domainMessage('PHONE_INVALID', { phoneNumber }),
    );
  }

  static otpInvalidOrExpired(): ValidationError {
    return new ValidationError(
      'OTP_INVALID_OR_EXPIRED',
      domainMessage('OTP_INVALID_OR_EXPIRED'),
    );
  }

  static otpTooManyRequests(): ValidationError {
    return new ValidationError(
      'OTP_TOO_MANY_REQUESTS',
      domainMessage('OTP_TOO_MANY_REQUESTS'),
    );
  }

  static otpResendTooEarly(): ConflictError {
    return new ConflictError(
      'OTP_RESEND_TOO_EARLY',
      domainMessage('OTP_RESEND_TOO_EARLY'),
    );
  }
}
