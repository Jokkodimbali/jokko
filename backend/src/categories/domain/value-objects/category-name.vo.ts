import { CategoryDomainError } from '../errors/category.domain-error';

export class CategoryName {
  private constructor(private readonly value: string) {}

  static create(raw: string | null | undefined): CategoryName | null {
    if (raw === undefined || raw === null) {
      return null;
    }

    const normalized = raw.trim().replace(/\s+/g, ' ');
    if (normalized.length < 2 || normalized.length > 100) {
      throw CategoryDomainError.invalidNameLength(normalized.length);
    }

    return new CategoryName(normalized);
  }

  getValue(): string {
    return this.value;
  }

  equals(other: CategoryName): boolean {
    return this.value === other.value;
  }
}
