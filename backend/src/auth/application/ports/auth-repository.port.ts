import { type RoleUtilisateur } from '@prisma/client';

export const AUTH_REPOSITORY_PORT = Symbol('AUTH_REPOSITORY_PORT');

export type AuthUserSummary = {
  id: string;
  numeroTelephone: string;
  nom: string;
  role: RoleUtilisateur;
  estActif: boolean;
};

export type AuthUserWithPassword = AuthUserSummary & {
  motDePasseHash: string | null;
};

export type AuthUserForGoogle = AuthUserSummary & {
  email: string | null;
  urlAvatar: string | null;
  identifiantOauth: string | null;
};

export type AuthPublicProfile = {
  id: string;
  numeroTelephone: string;
  nom: string;
  email: string | null;
  role: RoleUtilisateur;
  urlAvatar: string | null;
  estActif: boolean;
};

export type AuthRefreshSession = {
  id: string;
  utilisateurId: string;
  expireLe: Date;
};

export interface AuthRepositoryPort {
  findByPhoneNumber(phoneNumber: string): Promise<AuthUserSummary | null>;
  findById(userId: string): Promise<AuthUserSummary | null>;
  findByEmail(email: string): Promise<AuthUserForGoogle | null>;
  findByGoogleIdentity(googleSub: string): Promise<AuthUserForGoogle | null>;
  findWithPasswordByPhoneNumber(
    phoneNumber: string,
  ): Promise<AuthUserWithPassword | null>;
  findWithPasswordByEmail(email: string): Promise<AuthUserWithPassword | null>;
  createClientByPhoneNumber(
    phoneNumber: string,
  ): Promise<AuthUserSummary | null>;
  createClientWithPassword(data: {
    phoneNumber: string;
    name: string;
    email?: string;
    passwordHash: string;
    role: RoleUtilisateur;
    adresse: string;
    medicalSpecialty?: string;
    medicalExpertises?: string[];
    medicalDocumentNames?: string[];
  }): Promise<AuthUserSummary | null>;
  createGoogleClient(data: {
    email: string;
    name: string;
    googleSub: string;
    avatarUrl?: string | null;
  }): Promise<AuthUserForGoogle | null>;
  findPublicProfileById(userId: string): Promise<AuthPublicProfile | null>;
  createRefreshSession(
    userId: string,
    tokenHash: string,
    expiresAt: Date,
    metadata?: {
      platform?: string;
      userAgent?: string;
    },
  ): Promise<unknown>;
  findActiveSessionByTokenHash(
    tokenHash: string,
  ): Promise<AuthRefreshSession | null>;
  revokeSessionById(sessionId: string): Promise<unknown>;
  revokeSessionByTokenHash(tokenHash: string): Promise<void>;
  rotateSessionToken(
    oldSessionId: string,
    userId: string,
    newTokenHash: string,
    expiresAt: Date,
    metadata?: {
      platform?: string;
      userAgent?: string;
    },
  ): Promise<unknown>;
  linkGoogleIdentity(userId: string, googleSub: string): Promise<unknown>;
}
