import { ProfessionalDomainError } from '../errors/professional.domain-error';

const MAX_LENGTH = 100;

export class City {
  private constructor(private readonly value: string) {}

  static create(raw: string | null | undefined): City | null {
    if (raw === undefined || raw === null) {
      return null;
    }

    const normalized = raw.trim();
    if (normalized.length === 0) {
      return null;
    }

    if (normalized.length > MAX_LENGTH) {
      throw ProfessionalDomainError.invalidCityLength(normalized.length);
    }

    return new City(normalized);
  }

  getValue(): string {
    return this.value;
  }

  equals(other: City): boolean {
    return this.value === other.value;
  }
}
