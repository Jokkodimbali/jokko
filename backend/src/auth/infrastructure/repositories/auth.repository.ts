import { Injectable } from '@nestjs/common';
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
        identifiantOauth: true,
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
  }) {
    try {
      return await this.prisma.utilisateur.create({
        data: {
          numeroTelephone: data.phoneNumber,
          nom: data.name,
          email: data.email,
          motDePasseHash: data.passwordHash,
          role: RoleUtilisateur.CLIENT,
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

  createRefreshSession(userId: string, tokenHash: string, expiresAt: Date) {
    return this.prisma.sessionAuthentification.create({
      data: {
        utilisateurId: userId,
        hashJeton: tokenHash,
        expireLe: expiresAt,
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
}
