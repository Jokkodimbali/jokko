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

    return new Bio(normalized);
  }

  getValue(): string {
    return this.value;
  }
}
