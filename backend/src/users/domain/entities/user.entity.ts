import { RoleUtilisateur } from '@prisma/client';

export class User {
  constructor(
    public readonly id: string,
    public readonly phoneNumber: string,
    public readonly name: string,
    public readonly role: RoleUtilisateur,
    public readonly email: string | null,
    public readonly isActive: boolean,
  ) {}

  isClient(): boolean {
    return this.role === RoleUtilisateur.CLIENT;
  }

  isProfessional(): boolean {
    return this.role === RoleUtilisateur.PRESTATAIRE;
  }

  isAdmin(): boolean {
    return this.role === RoleUtilisateur.ADMIN;
  }

  canAccessAdminPanel(): boolean {
    return this.role === RoleUtilisateur.ADMIN;
  }

  canBookServices(): boolean {
    return (
      this.isActive &&
      (this.role === RoleUtilisateur.CLIENT ||
        this.role === RoleUtilisateur.PRESTATAIRE)
    );
  }

  canProvideServices(): boolean {
    return this.isActive && this.role === RoleUtilisateur.PRESTATAIRE;
  }

  canUpdateProfile(): boolean {
    return this.isActive;
  }

  canDeleteAccount(): boolean {
    return this.isActive;
  }

  toPublicProfile(): UserPublicProfile {
    return {
      id: this.id,
      phoneNumber: this.phoneNumber,
      name: this.name,
      role: this.role,
      email: this.email,
    };
  }

  toMeView(): UserMeView {
    return {
      id: this.id,
      phoneNumber: this.phoneNumber,
      name: this.name,
      email: this.email,
      role: this.role,
      isActive: this.isActive,
    };
  }
}

export interface UserPublicProfile {
  id: string;
  phoneNumber: string;
  name: string;
  role: RoleUtilisateur;
  email: string | null;
}

export interface UserMeView {
  id: string;
  phoneNumber: string;
  name: string;
  email: string | null;
  role: RoleUtilisateur;
  isActive: boolean;
}
