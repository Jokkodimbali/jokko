export class UserDomainError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'UserDomainError';
  }

  static userNotFound(): UserDomainError {
    return new UserDomainError('USER_NOT_FOUND', 'Utilisateur introuvable');
  }

  static userAlreadyExists(identifier: string): UserDomainError {
    return new UserDomainError(
      'USER_ALREADY_EXISTS',
      `L'utilisateur avec ${identifier} existe déjà`,
    );
  }

  static userNotActive(): UserDomainError {
    return new UserDomainError(
      'USER_NOT_ACTIVE',
      'Le compte utilisateur est désactivé',
    );
  }

  static invalidEmail(email: string): UserDomainError {
    return new UserDomainError(
      'INVALID_EMAIL',
      `L'email ${email} est invalide`,
    );
  }

  static emailAlreadyUsed(email: string): UserDomainError {
    return new UserDomainError(
      'EMAIL_ALREADY_USED',
      `L'email ${email} est déjà utilisé`,
    );
  }

  static cannotDeleteActiveUser(): UserDomainError {
    return new UserDomainError(
      'CANNOT_DELETE_ACTIVE_USER',
      'Impossible de supprimer un utilisateur actif',
    );
  }
}
