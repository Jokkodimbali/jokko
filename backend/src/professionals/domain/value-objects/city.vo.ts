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

    return new City(normalized);
  }

  getValue(): string {
    return this.value;
  }
}
