import { ProfessionalDomainError } from '../errors/professional.domain-error';

export class KycIdCardUrl {
  private constructor(private readonly value: string) {}

  static create(raw: string | null | undefined): KycIdCardUrl {
    if (raw === undefined || raw === null) {
      throw ProfessionalDomainError.invalidKycUrl('');
    }

    const normalized = raw.trim();
    if (normalized.length === 0) {
      throw ProfessionalDomainError.invalidKycUrl('');
    }

    const urlPattern = /^https?:\/\/.+$/i;
    if (!urlPattern.test(normalized)) {
      throw ProfessionalDomainError.invalidKycUrl(normalized);
    }

    return new KycIdCardUrl(normalized);
  }

  getValue(): string {
    return this.value;
  }

  equals(other: KycIdCardUrl): boolean {
    return this.value === other.value;
  }
}
