import { ValidationError } from '../../../shared/domain/errors/domain-error';
import { domainMessage } from '../../../core/messages/domain-message.catalog';

export class CategoryDomainError extends ValidationError {
  constructor(code: string, message: string) {
    super(code, message);
  }

  static invalidNameLength(length: number): CategoryDomainError {
    return new CategoryDomainError(
      'INVALID_CATEGORY_NAME_LENGTH',
      domainMessage('INVALID_CATEGORY_NAME_LENGTH', { length }),
    );
  }

  static invalidIconUrl(url: string): CategoryDomainError {
    return new CategoryDomainError(
      'INVALID_CATEGORY_ICON_URL',
      domainMessage('INVALID_CATEGORY_ICON_URL', { url }),
    );
  }

  static invalidSortOrder(value: number): CategoryDomainError {
    return new CategoryDomainError(
      'INVALID_CATEGORY_SORT_ORDER',
      domainMessage('INVALID_CATEGORY_SORT_ORDER', { value }),
    );
  }
}
