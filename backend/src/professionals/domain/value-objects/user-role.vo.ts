/**
 * Value Object representing a user role in the professionals context.
 * Decoupled from Prisma's RoleUtilisateur enum to respect DIP.
 */
import { ProfessionalDomainError } from '../errors/professional.domain-error';

export type UserRole = 'PRESTATAIRE' | 'CLIENT' | 'ADMIN';

export class UserRoleVO {
  private constructor(public readonly value: UserRole) {}

  static create(role: string): UserRoleVO {
    if (!['PRESTATAIRE', 'CLIENT', 'ADMIN'].includes(role)) {
      throw ProfessionalDomainError.invalidRole(role);
    }
    return new UserRoleVO(role as UserRole);
  }

  isProfessional(): boolean {
    return this.value === 'PRESTATAIRE';
  }

  isAdmin(): boolean {
    return this.value === 'ADMIN';
  }

  getValue(): UserRole {
    return this.value;
  }
}
