import { DomainValidationError } from '../errors/domain-validation.error';

export class PhoneNumberValidator {
  normalizeOrThrow(phoneNumber: string): string {
    const normalized = phoneNumber.trim();
    if (!/^\+?[1-9]\d{7,14}$/.test(normalized)) {
      throw new DomainValidationError('AUTH_PHONE_INVALID');
    }
    return normalized;
  }
}
