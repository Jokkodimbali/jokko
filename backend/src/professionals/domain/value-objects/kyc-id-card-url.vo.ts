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

export class KycIdCardUrlVerso {
  private constructor(private readonly value: string | null) {}

  static create(raw: string | null | undefined): KycIdCardUrlVerso {
    if (raw === undefined || raw === null) {
      return new KycIdCardUrlVerso(null);
    }

    const normalized = raw.trim();
    if (normalized.length === 0) {
      return new KycIdCardUrlVerso(null);
    }

    const urlPattern = /^https?:\/\/.+$/i;
    if (!urlPattern.test(normalized)) {
      throw ProfessionalDomainError.invalidKycUrl(normalized);
    }

    return new KycIdCardUrlVerso(normalized);
  }

  getValue(): string | null {
    return this.value;
  }

  isPresent(): boolean {
    return this.value !== null;
  }
}
