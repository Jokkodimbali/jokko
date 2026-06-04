import { Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
import { Prisma, RoleUtilisateur } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import type { AuthRepositoryPort } from '../../application/ports/auth-repository.port';

@Injectable()
export class AuthRepository implements AuthRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  findByPhoneNumber(phoneNumber: string) {
    return this.prisma.utilisateur.findUnique({
      where: { numeroTelephone: phoneNumber },
    });
  }

  findById(userId: string) {
    return this.prisma.utilisateur.findUnique({
      where: { id: userId },
      select: {
        id: true,
        numeroTelephone: true,
        nom: true,
        role: true,
        estActif: true,
      },
    });
  }

  findByEmail(email: string) {
    return this.prisma.utilisateur.findUnique({
      where: { email },
      select: {
        id: true,
        numeroTelephone: true,
        nom: true,
        role: true,
        email: true,
        urlAvatar: true,
        identifiantOauth: true,
        estActif: true,
      },
    });
  }

  findByGoogleIdentity(googleSub: string) {
    return this.prisma.utilisateur.findFirst({
      where: {
        fournisseurOauth: 'google',
        identifiantOauth: googleSub,
      },
      select: {
        id: true,
        numeroTelephone: true,
        nom: true,
        role: true,
        email: true,
        urlAvatar: true,
        identifiantOauth: true,
        estActif: true,
      },
    });
  }

  findWithPasswordByPhoneNumber(phoneNumber: string) {
    return this.prisma.utilisateur.findUnique({
      where: { numeroTelephone: phoneNumber },
      select: {
        id: true,
        numeroTelephone: true,
        nom: true,
        role: true,
        motDePasseHash: true,
        estActif: true,
      },
    });
  }

  async createClientByPhoneNumber(phoneNumber: string) {
    try {
      return await this.prisma.utilisateur.create({
        data: {
          numeroTelephone: phoneNumber,
          nom: `Utilisateur ${phoneNumber}`,
          role: RoleUtilisateur.CLIENT,
          estActif: true,
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        return null;
      }
      throw error;
    }
  }

  async createClientWithPassword(data: {
    phoneNumber: string;
    name: string;
    email?: string;
    passwordHash: string;
    role: RoleUtilisateur;
    adresse: string;
    medicalSpecialty?: string;
    medicalExpertises?: string[];
    medicalDocumentNames?: string[];
  }) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const user = await tx.utilisateur.create({
          data: {
            numeroTelephone: data.phoneNumber,
            nom: data.name,
            email: data.email,
            motDePasseHash: data.passwordHash,
            role: data.role,
            adresse: data.adresse,
            estActif: true,
          },
        });

        if (
          data.role === RoleUtilisateur.PRESTATAIRE ||
          data.role === RoleUtilisateur.MEDECIN
        ) {
          await tx.profilProfessionnel.create({
            data: {
              utilisateurId: user.id,
              nomEntreprise: data.name,
              ville: this.extractCity(data.adresse),
              biographie: this.buildProfessionalBiography(data),
              statutKyc: 'EN_ATTENTE',
            },
          });
        }

        return user;
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        return null;
      }
      throw error;
    }
  }

  async createGoogleClient(data: {
    email: string;
    name: string;
    googleSub: string;
    avatarUrl?: string | null;
  }) {
    try {
      return await this.prisma.utilisateur.create({
        data: {
          numeroTelephone: this.googlePhoneNumber(data.googleSub),
          nom: data.name,
          email: data.email,
          role: RoleUtilisateur.CLIENT,
          urlAvatar: data.avatarUrl,
          fournisseurOauth: 'google',
          identifiantOauth: data.googleSub,
          estActif: true,
        },
        select: {
          id: true,
          numeroTelephone: true,
          nom: true,
          role: true,
          email: true,
          urlAvatar: true,
          identifiantOauth: true,
          estActif: true,
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        return null;
      }
      throw error;
    }
  }

  findPublicProfileById(userId: string) {
    return this.prisma.utilisateur.findUnique({
      where: { id: userId },
      select: {
        id: true,
        numeroTelephone: true,
        nom: true,
        email: true,
        role: true,
        urlAvatar: true,
        estActif: true,
      },
    });
  }

  createRefreshSession(
    userId: string,
    tokenHash: string,
    expiresAt: Date,
    metadata?: { platform?: string; userAgent?: string },
  ) {
    return this.prisma.sessionAuthentification.create({
      data: {
        utilisateurId: userId,
        hashJeton: tokenHash,
        expireLe: expiresAt,
        plateforme: metadata?.platform,
        userAgent: metadata?.userAgent,
      },
    });
  }

  findWithPasswordByEmail(email: string) {
    return this.prisma.utilisateur.findUnique({
      where: { email },
      select: {
        id: true,
        numeroTelephone: true,
        nom: true,
        role: true,
        motDePasseHash: true,
        estActif: true,
      },
    });
  }

  findActiveSessionByTokenHash(tokenHash: string) {
    return this.prisma.sessionAuthentification.findFirst({
      where: {
        hashJeton: tokenHash,
        revoqueLe: null,
      },
    });
  }

  revokeSessionById(sessionId: string) {
    return this.prisma.sessionAuthentification.update({
      where: { id: sessionId },
      data: { revoqueLe: new Date() },
    });
  }

  async revokeSessionByTokenHash(tokenHash: string) {
    await this.prisma.sessionAuthentification.updateMany({
      where: { hashJeton: tokenHash, revoqueLe: null },
      data: { revoqueLe: new Date() },
    });
  }

  rotateSessionToken(
    oldSessionId: string,
    userId: string,
    newTokenHash: string,
    expiresAt: Date,
    metadata?: { platform?: string; userAgent?: string },
  ) {
    return this.prisma.$transaction(async (tx) => {
      await tx.sessionAuthentification.update({
        where: { id: oldSessionId },
        data: { revoqueLe: new Date() },
      });
      await tx.sessionAuthentification.create({
        data: {
          utilisateurId: userId,
          hashJeton: newTokenHash,
          expireLe: expiresAt,
          plateforme: metadata?.platform,
          userAgent: metadata?.userAgent,
        },
      });
    });
  }

  linkGoogleIdentity(userId: string, googleSub: string) {
    return this.prisma.utilisateur.update({
      where: { id: userId },
      data: {
        fournisseurOauth: 'google',
        identifiantOauth: googleSub,
      },
    });
  }

  private googlePhoneNumber(googleSub: string): string {
    const digest = createHash('sha256').update(googleSub).digest('hex');
    return `google-${digest.slice(0, 12)}`;
  }

  private extractCity(address: string): string | undefined {
    const city = address.split(',')[0]?.trim();
    return city || undefined;
  }

  private buildProfessionalBiography(data: {
    role: RoleUtilisateur;
    medicalSpecialty?: string;
    medicalExpertises?: string[];
    medicalDocumentNames?: string[];
  }): string | undefined {
    if (data.role !== RoleUtilisateur.MEDECIN) {
      return undefined;
    }

    const sections = [
      data.medicalSpecialty ? `Specialite: ${data.medicalSpecialty}` : null,
      data.medicalExpertises?.length
        ? `Expertises: ${data.medicalExpertises.join(', ')}`
        : null,
      data.medicalDocumentNames?.length
        ? `Documents: ${data.medicalDocumentNames.join(', ')}`
        : null,
    ].filter(Boolean);

    return sections.length ? sections.join('\n') : 'Profil medecin en attente de verification.';
  }
}
