export class Email {
  private constructor(private readonly value: string) {}

  static create(raw: string | null | undefined): Email | null {
    if (!raw) return null;

    const normalized = raw.trim().toLowerCase();
    if (normalized.length === 0) return null;

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(normalized)) {
      return null;
    }

    return new Email(normalized);
  }

  getValue(): string {
    return this.value;
  }

  equals(other: Email): boolean {
    return this.value === other.value;
  }
}
