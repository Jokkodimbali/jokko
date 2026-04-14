import {
  ValidationError,
  ConflictError,
  NotFoundError,
} from '../../../shared/domain/errors/domain-error';

export class UserDomainError extends ValidationError {
  constructor(code: string, message: string) {
    super(code, message);
  }

  static userNotFound(): NotFoundError {
    return new NotFoundError('USER_NOT_FOUND', 'Utilisateur introuvable');
  }

  static userAlreadyExists(identifier: string): ConflictError {
    return new ConflictError(
      'USER_ALREADY_EXISTS',
      `L'utilisateur avec ${identifier} existe déjà`,
    );
  }

  static userNotActive(): ValidationError {
    return new ValidationError(
      'USER_NOT_ACTIVE',
      'Le compte utilisateur est désactivé',
    );
  }

  static userAlreadyDeactivated(): ConflictError {
    return new ConflictError(
      'USER_ALREADY_DEACTIVATED',
      'Le compte utilisateur est déjà désactivé',
    );
  }

  static invalidEmail(email: string): ValidationError {
    return new ValidationError(
      'INVALID_EMAIL',
      `L'email ${email} est invalide`,
    );
  }

  static emailAlreadyUsed(email: string): ConflictError {
    return new ConflictError(
      'EMAIL_ALREADY_USED',
      `L'email ${email} est déjà utilisé`,
    );
  }

  static invalidName(name: string): ValidationError {
    return new ValidationError(
      'INVALID_NAME',
      `Le nom "${name}" est trop court (minimum 2 caractères)`,
    );
  }

  static invalidAddress(): ValidationError {
    return new ValidationError(
      'INVALID_ADDRESS',
      `L'adresse est trop longue (maximum ${255} caractères)`,
    );
  }

  static cannotDeleteActiveUser(): ValidationError {
    return new ValidationError(
      'CANNOT_DELETE_ACTIVE_USER',
      'Impossible de supprimer un utilisateur actif',
    );
  }
}
