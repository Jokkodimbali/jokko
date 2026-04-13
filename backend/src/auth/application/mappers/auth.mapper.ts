import type { AuthUserSummary } from '../../application/ports/auth-repository.port';

export type AuthApiUser = {
  id: string;
  phoneNumber: string;
  name: string;
  role: string;
  email?: string | null;
};

export class AuthMapper {
  static toApiUser(user: AuthUserSummary): AuthApiUser {
    return {
      id: user.id,
      phoneNumber: user.numeroTelephone,
      name: user.nom,
      role: user.role,
    };
  }

  static toApiUserWithEmail(
    user: AuthUserSummary & { email?: string | null },
  ): AuthApiUser {
    return {
      ...this.toApiUser(user),
      email: user.email,
    };
  }
}
