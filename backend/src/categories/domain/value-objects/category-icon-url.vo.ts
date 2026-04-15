import { CategoryDomainError } from '../errors/category.domain-error';

export class CategoryIconUrl {
  private constructor(private readonly value: string) {}

  static create(raw: string | null | undefined): CategoryIconUrl | null {
    if (raw === undefined || raw === null) {
      return null;
    }

    const normalized = raw.trim();
    if (normalized.length === 0) {
      return null;
    }

    try {
      const parsedUrl = new URL(normalized);
      if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
        throw new Error('protocol_not_supported');
      }
      return new CategoryIconUrl(normalized);
    } catch {
      throw CategoryDomainError.invalidIconUrl(raw);
    }
  }

  getValue(): string {
    return this.value;
  }

  equals(other: CategoryIconUrl): boolean {
    return this.value === other.value;
  }
}
