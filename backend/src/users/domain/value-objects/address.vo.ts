import { UserDomainError } from '../errors/user.domain-error';

const MAX_ADDRESS_LENGTH = 255;

export class Address {
  private constructor(private readonly value: string) {}

  static create(raw: string | null | undefined): Address | null {
    if (raw === undefined || raw === null) {
      return null;
    }

    const normalized = raw.trim();
    if (normalized.length === 0) {
      return null;
    }

    if (normalized.length > MAX_ADDRESS_LENGTH) {
      throw UserDomainError.invalidAddress();
    }

    return new Address(normalized);
  }

  getValue(): string {
    return this.value;
  }

  equals(other: Address): boolean {
    return this.value === other.value;
  }

  getCity(): string | null {
    const parts = this.value.split(',').map((p) => p.trim());
    return parts.length > 1 ? parts[parts.length - 2] : null;
  }

  getCountry(): string | null {
    const parts = this.value.split(',').map((p) => p.trim());
    return parts.length > 1 ? parts[parts.length - 1] : null;
  }
}
