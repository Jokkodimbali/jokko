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

    return new CompanyName(normalized);
  }

  getValue(): string {
    return this.value;
  }
}
