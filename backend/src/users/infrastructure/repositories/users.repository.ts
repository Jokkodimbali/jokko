import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import type {
  UserProfileUpdateInput,
  UserProfileUpdateResult,
  UsersRepositoryPort,
} from '../../application/ports/users-repository.port';

@Injectable()
export class UsersRepository implements UsersRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  private readonly userMeSelect = {
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

  findMeById(userId: string) {
    return this.prisma.utilisateur.findUnique({
      where: { id: userId },
      select: this.userMeSelect,
    });
  }

  findByEmail(email: string) {
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
        select: this.userMeSelect,
      });
      return { status: 'updated', user };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        return { status: 'not_found' };
      }
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        return { status: 'email_conflict' };
      }
      throw error;
    }
  }

  async anonymizeAndRevokeById(userId: string, replacementPhoneNumber: string) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        await tx.sessionAuthentification.updateMany({
          where: { utilisateurId: userId, revoqueLe: null },
          data: { revoqueLe: new Date() },
        });

        return tx.utilisateur.update({
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
          select: this.userMeSelect,
        });
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        return null;
      }
      throw error;
    }
  }

  async listClientHistory(userId: string, limit: number) {
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
