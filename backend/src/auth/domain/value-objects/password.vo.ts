import { AuthDomainError } from '../errors/auth.domain-error';

export class Password {
  private constructor(private readonly value: string) {}

  static create(raw: string): Password {
    if (!raw || raw.trim().length === 0) {
      throw AuthDomainError.passwordRequired();
    }

    const trimmed = raw.trim();

    if (trimmed.length < 8) {
      throw AuthDomainError.passwordTooShort(trimmed.length);
    }

    if (trimmed.length > 64) {
      throw AuthDomainError.passwordTooLong(trimmed.length);
    }

    return new Password(trimmed);
  }

  static createOptional(raw: string | null | undefined): Password | null {
    if (raw === null || raw === undefined || raw.trim().length === 0) {
      return null;
    }
    return Password.create(raw);
  }

  getValue(): string {
    return this.value;
  }

  equals(other: Password): boolean {
    return this.value === other.value;
  }

  meetsStrengthRequirements(): boolean {
    const hasUpperCase = /[A-Z]/.test(this.value);
    const hasLowerCase = /[a-z]/.test(this.value);
    const hasNumber = /[0-9]/.test(this.value);
    const hasSpecialChar = /[!@#$%^&*()_+\-={};'"|,.<>?]/.test(this.value);

    const strengthScore = [
      hasUpperCase,
      hasLowerCase,
      hasNumber,
      hasSpecialChar,
    ].filter(Boolean).length;
    return strengthScore >= 3;
  }

  getStrengthScore(): number {
    let score = 0;

    if (this.value.length >= 8) score++;
    if (this.value.length >= 12) score++;
    if (/[A-Z]/.test(this.value)) score++;
    if (/[a-z]/.test(this.value)) score++;
    if (/[0-9]/.test(this.value)) score++;
    if (/[!@#$%^&*()_+\-={};'"|,.<>?]/.test(this.value)) score++;

    return score;
  }
}
