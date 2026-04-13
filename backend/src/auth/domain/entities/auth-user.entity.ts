import { type RoleUtilisateur } from '@prisma/client';

export class AuthUser {
  constructor(
    public readonly id: string,
    public readonly phoneNumber: string,
    public readonly role: RoleUtilisateur,
    public readonly passwordHash: string | null,
    public readonly isActive: boolean,
  ) {}

  hasPassword(): boolean {
    return this.passwordHash !== null;
  }

  isActiveUser(): boolean {
    return this.isActive;
  }

  canAuthenticate(): boolean {
    return this.isActive && (this.hasPassword() || this.hasOAuth());
  }

  hasOAuth(): boolean {
    return false;
  }

  toAuthSummary(): AuthUserSummary {
    return {
      id: this.id,
      phoneNumber: this.phoneNumber,
      role: this.role,
    };
  }
}

export interface AuthUserSummary {
  id: string;
  phoneNumber: string;
  role: RoleUtilisateur;
}

export interface AuthUserWithPassword extends AuthUserSummary {
  passwordHash: string | null;
}
