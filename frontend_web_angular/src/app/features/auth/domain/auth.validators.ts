import { ValidatorFn, Validators } from '@angular/forms';

export const SENEGAL_PHONE_DIAL_CODE = '+221';
export const SENEGAL_PHONE_PATTERN = '^\\+221(?:3[03-9]|7[015678])\\d{7}$';
export const SENEGAL_LOCAL_PHONE_PATTERN = '^(?:3[03-9]|7[015678])\\d{7}$';
export const EMAIL_PATTERN = '^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$';
export const LOGIN_IDENTIFIER_PATTERN = `(?:${SENEGAL_PHONE_PATTERN.slice(1, -1)}|${SENEGAL_LOCAL_PHONE_PATTERN.slice(1, -1)}|${EMAIL_PATTERN.slice(1, -1)})`;
export const OTP_CODE_PATTERN = '^[0-9]{6}$';

type AuthValidatorCatalog = {
  loginIdentifier: ValidatorFn[];
  phoneNumber: ValidatorFn[];
  password: ValidatorFn[];
  otpCode: ValidatorFn[];
  name: ValidatorFn[];
  address: ValidatorFn[];
};

export const AUTH_VALIDATORS: AuthValidatorCatalog = {
  loginIdentifier: [Validators.required, Validators.pattern(LOGIN_IDENTIFIER_PATTERN)],
  phoneNumber: [Validators.required, Validators.pattern(SENEGAL_PHONE_PATTERN)],
  password: [Validators.required, Validators.minLength(8), Validators.maxLength(64)],
  otpCode: [
    Validators.required,
    Validators.minLength(6),
    Validators.maxLength(6),
    Validators.pattern(OTP_CODE_PATTERN),
  ],
  name: [Validators.required, Validators.minLength(2), Validators.maxLength(100)],
  address: [Validators.required, Validators.minLength(5), Validators.maxLength(255)],
};

export function normalizeSenegalPhoneNumber(value: string): string {
  const sanitized = value.trim().replace(/[()\s.-]/g, '');

  if (!sanitized) {
    return SENEGAL_PHONE_DIAL_CODE;
  }

  if (sanitized.startsWith('00221')) {
    return `${SENEGAL_PHONE_DIAL_CODE}${sanitized.slice(5)}`;
  }

  if (sanitized.startsWith('221')) {
    return `${SENEGAL_PHONE_DIAL_CODE}${sanitized.slice(3)}`;
  }

  if (sanitized.startsWith(SENEGAL_PHONE_DIAL_CODE)) {
    return sanitized;
  }

  if (sanitized.startsWith('0')) {
    return `${SENEGAL_PHONE_DIAL_CODE}${sanitized.slice(1)}`;
  }

  return `${SENEGAL_PHONE_DIAL_CODE}${sanitized}`;
}

export function normalizeLoginIdentifier(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return '';
  }

  return trimmed.includes('@') ? trimmed.toLowerCase() : normalizeSenegalPhoneNumber(trimmed);
}

export function toSenegalLocalPhoneInput(value: string): string {
  const normalized = normalizeSenegalPhoneNumber(value);
  return normalized.startsWith(SENEGAL_PHONE_DIAL_CODE)
    ? normalized.slice(SENEGAL_PHONE_DIAL_CODE.length)
    : value.trim();
}

export function toLoginIdentifierInput(value: string | null): string {
  if (!value) {
    return '';
  }

  return value.includes('@') ? value.trim().toLowerCase() : toSenegalLocalPhoneInput(value);
}

export function isDisplayableSenegalPhoneNumber(value: string | null | undefined): boolean {
  if (!value) {
    return false;
  }

  return new RegExp(SENEGAL_PHONE_PATTERN).test(normalizeSenegalPhoneNumber(value));
}

export function displaySenegalPhoneNumber(value: string | null | undefined): string | null {
  return isDisplayableSenegalPhoneNumber(value) ? normalizeSenegalPhoneNumber(value ?? '') : null;
}
