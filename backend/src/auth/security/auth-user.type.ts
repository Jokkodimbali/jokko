import type { RoleUtilisateur } from '@prisma/client';

export type AuthUser = {
  sub: string;
  role: RoleUtilisateur;
  phoneNumber: string;
};
