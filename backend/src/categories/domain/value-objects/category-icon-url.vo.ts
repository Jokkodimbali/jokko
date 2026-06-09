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

    if (/^lucide:[a-z0-9-]+$/.test(normalized)) {
      return new CategoryIconUrl(normalized);
    }

    try {
      const parsedUrl = new URL(normalized);
      if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
        throw CategoryDomainError.invalidIconUrl(raw);
      }
      return new CategoryIconUrl(normalized);
    } catch (error) {
      if (error instanceof CategoryDomainError) {
        throw error;
      }
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
