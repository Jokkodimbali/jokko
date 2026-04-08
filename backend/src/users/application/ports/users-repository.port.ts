import type { RoleUtilisateur } from '@prisma/client';

export const USERS_REPOSITORY_PORT = Symbol('USERS_REPOSITORY_PORT');

export type UserMeView = {
  id: string;
  numeroTelephone: string;
  nom: string;
  email: string | null;
  role: RoleUtilisateur;
  urlAvatar: string | null;
  estActif: boolean;
  creeLe: Date;
};

export interface UsersRepositoryPort {
  findMeById(userId: string): Promise<UserMeView | null>;
}
