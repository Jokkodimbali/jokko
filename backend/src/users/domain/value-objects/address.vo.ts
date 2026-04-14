export class Address {
  private constructor(private readonly value: string) {}

  static create(raw: string | null | undefined): Address | null {
    if (!raw) return null;

    const normalized = raw.trim();
    if (normalized.length === 0) return null;

    if (normalized.length > 255) {
      return null;
    }

    return new Address(normalized);
  }

  getValue(): string {
    return this.value;
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
