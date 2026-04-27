import { CategoryDomainError } from '../errors/category.domain-error';

export class CategorySortOrder {
  private constructor(private readonly value: number) {}

  static create(raw: number | null | undefined): CategorySortOrder | null {
    if (raw === undefined || raw === null) {
      return null;
    }

    if (!Number.isInteger(raw) || raw < 0 || raw > 32767) {
      throw CategoryDomainError.invalidSortOrder(raw);
    }

    return new CategorySortOrder(raw);
  }

  getValue(): number {
    return this.value;
  }

  equals(other: CategorySortOrder): boolean {
    return this.value === other.value;
  }
}
