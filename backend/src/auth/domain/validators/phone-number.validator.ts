import { DomainValidationError } from '../errors/domain-validation.error';

export const SENEGAL_PHONE_PATTERN = /^\+221(?:3[03-9]|7[015678])\d{7}$/;

export function normalizeSenegalPhoneNumber(phoneNumber: string): string {
  const sanitized = phoneNumber.trim().replace(/[()\s.-]/g, '');

  if (!sanitized) {
    return sanitized;
  }

  if (sanitized.startsWith('00221')) {
    return `+221${sanitized.slice(5)}`;
  }

  if (sanitized.startsWith('221')) {
    return `+221${sanitized.slice(3)}`;
  }

  if (sanitized.startsWith('+221')) {
    return sanitized;
  }

  if (sanitized.startsWith('0')) {
    return `+221${sanitized.slice(1)}`;
  }

  return `+221${sanitized}`;
}

export class PhoneNumberValidator {
  normalizeOrThrow(phoneNumber: string): string {
    const normalized = normalizeSenegalPhoneNumber(phoneNumber);
    if (!SENEGAL_PHONE_PATTERN.test(normalized)) {
      throw new DomainValidationError('AUTH_PHONE_INVALID');
    }
    return normalized;
  }
}
