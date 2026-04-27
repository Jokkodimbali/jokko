import { ProfessionalDomainError } from '../errors/professional.domain-error';

const MAX_LENGTH = 1000;

export class Bio {
  private constructor(private readonly value: string) {}

  static create(raw: string | null | undefined): Bio | null {
    if (raw === undefined || raw === null) {
      return null;
    }

    const normalized = raw.trim();
    if (normalized.length === 0) {
      return null;
    }

    if (normalized.length > MAX_LENGTH) {
      throw ProfessionalDomainError.invalidBioLength(normalized.length);
    }

    return new Bio(normalized);
  }

  getValue(): string {
    return this.value;
  }

  equals(other: Bio): boolean {
    return this.value === other.value;
  }
}
