import { TECHNICAL_MESSAGES } from '../../../core/messages/technical-message.catalog';

export class PhoneNumber {
  private constructor(private readonly value: string) {}

  static create(raw: string): PhoneNumber {
    const normalized = raw.trim();
    const phoneRegex = /^\+?[1-9]\d{7,14}$/;

    if (!phoneRegex.test(normalized)) {
      throw new Error(TECHNICAL_MESSAGES.INVALID_PHONE_NUMBER_CODE);
    }

    return new PhoneNumber(normalized);
  }

  static createOrNull(raw: string | null | undefined): PhoneNumber | null {
    if (!raw) return null;
    try {
      return PhoneNumber.create(raw);
    } catch {
      return null;
    }
  }

  getValue(): string {
    return this.value;
  }

  getCountryCode(): string | null {
    const match = new RegExp(/^\+(\d{1,3})/).exec(this.value);
    return match ? match[1] : null;
  }

  getNationalNumber(): string {
    return this.value.replace(/^\+\d{1,3}/, '');
  }

  isSenegalese(): boolean {
    return this.value.startsWith('+221');
  }

  toE164(): string {
    if (this.value.startsWith('+')) {
      return this.value;
    }
    return `+${this.value}`;
  }

  equals(other: PhoneNumber): boolean {
    return this.value === other.value;
  }
}
