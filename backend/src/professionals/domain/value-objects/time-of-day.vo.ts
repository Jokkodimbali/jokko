import { ProfessionalDomainError } from '../errors/professional.domain-error';

/**
 * Value Object representing a time of day (HH:mm).
 * Encapsulates parsing and validation.
 */
export class TimeOfDay {
  private constructor(
    private readonly hours: number,
    private readonly minutes: number,
  ) {}

  static fromString(raw: string): TimeOfDay {
    const match = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(raw);
    if (!match) {
      throw ProfessionalDomainError.invalidTimeFormat(raw);
    }

    const hours = Number(match[1]);
    const minutes = Number(match[2]);

    return new TimeOfDay(hours, minutes);
  }

  static fromNumbers(hours: number, minutes: number): TimeOfDay {
    if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
      throw ProfessionalDomainError.invalidTimeFormat(`${hours}:${minutes}`);
    }
    return new TimeOfDay(hours, minutes);
  }

  /**
   * Convert to a Date (epoch-based) for storage compatibility.
   */
  toDate(): Date {
    return new Date(Date.UTC(1970, 0, 1, this.hours, this.minutes, 0));
  }

  getValue(): string {
    return `${String(this.hours).padStart(2, '0')}:${String(this.minutes).padStart(2, '0')}`;
  }
}
