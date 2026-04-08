import { PrismaService } from '../../../prisma/prisma.service';
import type { UsersRepositoryPort } from '../../application/ports/users-repository.port';
export declare class UsersRepository implements UsersRepositoryPort {
    private readonly prisma;
    constructor(prisma: PrismaService);
    findMeById(userId: string): import("@prisma/client").Prisma.Prisma__UtilisateurClient<{
        id: string;
        nom: string;
        numeroTelephone: string;
        email: string | null;
        role: import("@prisma/client").$Enums.RoleUtilisateur;
        urlAvatar: string | null;
        estActif: boolean;
        creeLe: Date;
    } | null, null, import("@prisma/client/runtime/client").DefaultArgs, import("@prisma/client").Prisma.PrismaClientOptions>;
}
