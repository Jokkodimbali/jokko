import { PrismaService } from '../../../prisma/prisma.service';
import type { AuthRepositoryPort } from '../../application/ports/auth-repository.port';
export declare class AuthRepository implements AuthRepositoryPort {
    private readonly prisma;
    constructor(prisma: PrismaService);
    findByPhoneNumber(phoneNumber: string): import("@prisma/client").Prisma.Prisma__UtilisateurClient<{
        id: string;
        nom: string;
        numeroTelephone: string;
        email: string | null;
        motDePasseHash: string | null;
        fournisseurOauth: string | null;
        identifiantOauth: string | null;
        role: import("@prisma/client").$Enums.RoleUtilisateur;
        urlAvatar: string | null;
        jetonFcm: string | null;
        estActif: boolean;
        creeLe: Date;
        misAJourLe: Date;
    } | null, null, import("@prisma/client/runtime/client").DefaultArgs, import("@prisma/client").Prisma.PrismaClientOptions>;
    findById(userId: string): import("@prisma/client").Prisma.Prisma__UtilisateurClient<{
        id: string;
        nom: string;
        numeroTelephone: string;
        role: import("@prisma/client").$Enums.RoleUtilisateur;
    } | null, null, import("@prisma/client/runtime/client").DefaultArgs, import("@prisma/client").Prisma.PrismaClientOptions>;
    findByEmail(email: string): import("@prisma/client").Prisma.Prisma__UtilisateurClient<{
        id: string;
        nom: string;
        numeroTelephone: string;
        email: string | null;
        identifiantOauth: string | null;
        role: import("@prisma/client").$Enums.RoleUtilisateur;
    } | null, null, import("@prisma/client/runtime/client").DefaultArgs, import("@prisma/client").Prisma.PrismaClientOptions>;
    findWithPasswordByPhoneNumber(phoneNumber: string): import("@prisma/client").Prisma.Prisma__UtilisateurClient<{
        id: string;
        nom: string;
        numeroTelephone: string;
        motDePasseHash: string | null;
        role: import("@prisma/client").$Enums.RoleUtilisateur;
    } | null, null, import("@prisma/client/runtime/client").DefaultArgs, import("@prisma/client").Prisma.PrismaClientOptions>;
    createClientByPhoneNumber(phoneNumber: string): import("@prisma/client").Prisma.Prisma__UtilisateurClient<{
        id: string;
        nom: string;
        numeroTelephone: string;
        email: string | null;
        motDePasseHash: string | null;
        fournisseurOauth: string | null;
        identifiantOauth: string | null;
        role: import("@prisma/client").$Enums.RoleUtilisateur;
        urlAvatar: string | null;
        jetonFcm: string | null;
        estActif: boolean;
        creeLe: Date;
        misAJourLe: Date;
    }, never, import("@prisma/client/runtime/client").DefaultArgs, import("@prisma/client").Prisma.PrismaClientOptions>;
    createClientWithPassword(data: {
        phoneNumber: string;
        name: string;
        email?: string;
        passwordHash: string;
    }): import("@prisma/client").Prisma.Prisma__UtilisateurClient<{
        id: string;
        nom: string;
        numeroTelephone: string;
        email: string | null;
        motDePasseHash: string | null;
        fournisseurOauth: string | null;
        identifiantOauth: string | null;
        role: import("@prisma/client").$Enums.RoleUtilisateur;
        urlAvatar: string | null;
        jetonFcm: string | null;
        estActif: boolean;
        creeLe: Date;
        misAJourLe: Date;
    }, never, import("@prisma/client/runtime/client").DefaultArgs, import("@prisma/client").Prisma.PrismaClientOptions>;
    findPublicProfileById(userId: string): import("@prisma/client").Prisma.Prisma__UtilisateurClient<{
        id: string;
        nom: string;
        numeroTelephone: string;
        email: string | null;
        role: import("@prisma/client").$Enums.RoleUtilisateur;
        urlAvatar: string | null;
        estActif: boolean;
    } | null, null, import("@prisma/client/runtime/client").DefaultArgs, import("@prisma/client").Prisma.PrismaClientOptions>;
    createRefreshSession(userId: string, tokenHash: string, expiresAt: Date): import("@prisma/client").Prisma.Prisma__SessionAuthentificationClient<{
        id: string;
        creeLe: Date;
        misAJourLe: Date;
        expireLe: Date;
        hashJeton: string;
        revoqueLe: Date | null;
        utilisateurId: string;
    }, never, import("@prisma/client/runtime/client").DefaultArgs, import("@prisma/client").Prisma.PrismaClientOptions>;
    findActiveSessionByTokenHash(tokenHash: string): import("@prisma/client").Prisma.Prisma__SessionAuthentificationClient<{
        id: string;
        creeLe: Date;
        misAJourLe: Date;
        expireLe: Date;
        hashJeton: string;
        revoqueLe: Date | null;
        utilisateurId: string;
    } | null, null, import("@prisma/client/runtime/client").DefaultArgs, import("@prisma/client").Prisma.PrismaClientOptions>;
    revokeSessionById(sessionId: string): import("@prisma/client").Prisma.Prisma__SessionAuthentificationClient<{
        id: string;
        creeLe: Date;
        misAJourLe: Date;
        expireLe: Date;
        hashJeton: string;
        revoqueLe: Date | null;
        utilisateurId: string;
    }, never, import("@prisma/client/runtime/client").DefaultArgs, import("@prisma/client").Prisma.PrismaClientOptions>;
    revokeSessionByTokenHash(tokenHash: string): Promise<void>;
    rotateSessionToken(oldSessionId: string, userId: string, newTokenHash: string, expiresAt: Date): Promise<void>;
    linkGoogleIdentity(userId: string, googleSub: string): import("@prisma/client").Prisma.Prisma__UtilisateurClient<{
        id: string;
        nom: string;
        numeroTelephone: string;
        email: string | null;
        motDePasseHash: string | null;
        fournisseurOauth: string | null;
        identifiantOauth: string | null;
        role: import("@prisma/client").$Enums.RoleUtilisateur;
        urlAvatar: string | null;
        jetonFcm: string | null;
        estActif: boolean;
        creeLe: Date;
        misAJourLe: Date;
    }, never, import("@prisma/client/runtime/client").DefaultArgs, import("@prisma/client").Prisma.PrismaClientOptions>;
}
