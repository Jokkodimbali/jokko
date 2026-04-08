import type { RoleUtilisateur } from '@prisma/client';
export declare const USERS_REPOSITORY_PORT: unique symbol;
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
