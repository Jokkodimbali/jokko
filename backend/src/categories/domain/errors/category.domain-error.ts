import { ValidationError } from '../../../shared/domain/errors/domain-error';

export class CategoryDomainError extends ValidationError {
  constructor(code: string, message: string) {
    super(code, message);
  }

  static invalidNameLength(length: number): CategoryDomainError {
    return new CategoryDomainError(
      'INVALID_CATEGORY_NAME_LENGTH',
      `Le nom de categorie doit contenir entre 2 et 100 caracteres. Longueur recue: ${length}.`,
    );
  }

  static invalidIconUrl(url: string): CategoryDomainError {
    return new CategoryDomainError(
      'INVALID_CATEGORY_ICON_URL',
      `L'URL d'icone de categorie est invalide: ${url}.`,
    );
  }

  static invalidSortOrder(value: number): CategoryDomainError {
    return new CategoryDomainError(
      'INVALID_CATEGORY_SORT_ORDER',
      `L'ordre de tri doit etre un entier entre 0 et 32767. Valeur recue: ${value}.`,
    );
  }
}
