import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import type {
  UserProfileUpdateInput,
  UserProfileUpdateResult,
  UserMeView,
  UserHistoryItem,
  UsersRepositoryPort,
} from '../../application/ports/users-repository.port';

// ─── Prisma Select Constants (DRY) ───────────────────────────────────────────

const USER_ME_SELECT = {
  id: true,
  numeroTelephone: true,
  nom: true,
  email: true,
  adresse: true,
  role: true,
  urlAvatar: true,
  estActif: true,
  creeLe: true,
} as const;

@Injectable()
export class UsersRepository implements UsersRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Helper Methods ────────────────────────────────────────────────────────

  private mapUserMe(user: {
    id: string;
    numeroTelephone: string;
    nom: string;
    email: string | null;
    adresse: string | null;
    role: string;
    urlAvatar: string | null;
    estActif: boolean;
    creeLe: Date;
  }): UserMeView {
    return {
      id: user.id,
      numeroTelephone: user.numeroTelephone,
      nom: user.nom,
      email: user.email,
      adresse: user.adresse,
      role: user.role as UserMeView['role'],
      urlAvatar: user.urlAvatar,
      estActif: user.estActif,
      creeLe: user.creeLe,
    };
  }

  private handlePrismaError<T extends { status: string }>(
    error: unknown,
    codeMap: Record<string, T['status']>,
  ): T | null {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      const status = codeMap[error.code];
      if (status) {
        return { status } as T;
      }
    }
    return null;
  }

  // ─── User Operations ───────────────────────────────────────────────────────

  async findMeById(userId: string): Promise<UserMeView | null> {
    const user = await this.prisma.utilisateur.findUnique({
      where: { id: userId },
      select: USER_ME_SELECT,
    });
    return user ? this.mapUserMe(user) : null;
  }

  async findByEmail(email: string): Promise<{ id: string } | null> {
    return this.prisma.utilisateur.findUnique({
      where: { email },
      select: { id: true },
    });
  }

  async updateMeById(
    userId: string,
    data: UserProfileUpdateInput,
  ): Promise<UserProfileUpdateResult> {
    try {
      const user = await this.prisma.utilisateur.update({
        where: { id: userId },
        data,
        select: USER_ME_SELECT,
      });
      return { status: 'updated', user: this.mapUserMe(user) };
    } catch (error) {
      const handled = this.handlePrismaError<UserProfileUpdateResult>(error, {
        P2025: 'not_found',
        P2002: 'email_conflict',
      });
      if (handled) return handled;
      throw error;
    }
  }

  async anonymizeAndRevokeById(
    userId: string,
    replacementPhoneNumber: string,
  ): Promise<UserMeView | null> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        await tx.sessionAuthentification.updateMany({
          where: { utilisateurId: userId, revoqueLe: null },
          data: { revoqueLe: new Date() },
        });

        const user = await tx.utilisateur.update({
          where: { id: userId },
          data: {
            numeroTelephone: replacementPhoneNumber,
            nom: 'Utilisateur supprime',
            email: null,
            motDePasseHash: null,
            fournisseurOauth: null,
            identifiantOauth: null,
            urlAvatar: null,
            jetonFcm: null,
            estActif: false,
          },
          select: USER_ME_SELECT,
        });
        return this.mapUserMe(user);
      });
    } catch (error) {
      const handled = this.handlePrismaError(error, {
        P2025: 'not_found',
      });
      if (handled) return null;
      throw error;
    }
  }

  async listClientHistory(
    userId: string,
    limit: number,
  ): Promise<UserHistoryItem[]> {
    const rows = await this.prisma.reservation.findMany({
      where: { clientId: userId },
      orderBy: { creeLe: 'desc' },
      take: limit,
      select: {
        id: true,
        statut: true,
        planifieeLe: true,
        adresseClient: true,
        prixAccorde: true,
        creeLe: true,
        service: {
          select: {
            id: true,
            nom: true,
            prix: true,
            typePrix: true,
          },
        },
      },
    });

    return rows.map((row) => ({
      id: row.id,
      statut: row.statut,
      planifieeLe: row.planifieeLe,
      adresseClient: row.adresseClient,
      prixAccorde:
        row.prixAccorde === null ? null : Number(row.prixAccorde.toString()),
      creeLe: row.creeLe,
      service: {
        id: row.service.id,
        nom: row.service.nom,
        prix: Number(row.service.prix.toString()),
        typePrix: row.service.typePrix,
      },
    }));
  }
}
