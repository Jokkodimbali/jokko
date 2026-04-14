import { ProfessionalDomainError } from '../errors/professional.domain-error';

const MAX_LENGTH = 150;

export class CompanyName {
  private constructor(private readonly value: string) {}

  static create(raw: string | null | undefined): CompanyName | null {
    if (raw === undefined || raw === null) {
      return null;
    }

    const normalized = raw.trim();
    if (normalized.length === 0) {
      return null;
    }

    if (normalized.length > MAX_LENGTH) {
      throw ProfessionalDomainError.invalidCompanyNameLength(normalized.length);
    }

    return new CompanyName(normalized);
  }

  getValue(): string {
    return this.value;
  }

  equals(other: CompanyName): boolean {
    return this.value === other.value;
  }
}
