import { Injectable } from '@nestjs/common';
import { Prisma, RoleUtilisateur } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import type {
  AdminUserHistoryView,
  AdminUserListItem,
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
  profilProfessionnel: {
    select: {
      id: true,
      nomEntreprise: true,
      services: {
        where: { estDisponible: true },
        select: {
          categorie: {
            select: {
              nom: true,
            },
          },
        },
      },
    },
  },
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
    profilProfessionnel: {
      id: string;
      nomEntreprise: string | null;
      services: Array<{
        categorie: {
          nom: string;
        };
      }>;
    } | null;
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
      profilProfessionnel: user.profilProfessionnel
        ? {
            id: user.profilProfessionnel.id,
            nomEntreprise: user.profilProfessionnel.nomEntreprise,
            categories: Array.from(
              new Set(
                user.profilProfessionnel.services.map(
                  (service) => service.categorie.nom,
                ),
              ),
            ),
          }
        : null,
    };
  }

  private mapUserHistoryItem(row: {
    id: string;
    statut: string;
    dateHeure: Date;
    notes: string | null;
    creeLe: Date;
    service: {
      id: string;
      nom: string;
      prix: Prisma.Decimal;
      typePrix: string;
    };
  }): UserHistoryItem {
    return {
      id: row.id,
      statut: row.statut as UserHistoryItem['statut'],
      dateHeure: row.dateHeure,
      notes: row.notes,
      creeLe: row.creeLe,
      service: {
        id: row.service.id,
        nom: row.service.nom,
        prix: Number(row.service.prix.toString()),
        typePrix: row.service
          .typePrix as UserHistoryItem['service']['typePrix'],
      },
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
        dateHeure: true,
        notes: true,
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

    return rows.map((row) => this.mapUserHistoryItem(row));
  }

  async listAdminUsers(query?: {
    role?: RoleUtilisateur;
    isActive?: boolean;
    search?: string;
    limit?: number;
    offset?: number;
  }): Promise<AdminUserListItem[]> {
    const users = await this.prisma.utilisateur.findMany({
      where: {
        ...(query?.role ? { role: query.role } : {}),
        ...(query?.isActive === undefined ? {} : { estActif: query.isActive }),
        ...(query?.search
          ? {
              OR: [
                { nom: { contains: query.search, mode: 'insensitive' } },
                {
                  numeroTelephone: {
                    contains: query.search,
                    mode: 'insensitive',
                  },
                },
                { email: { contains: query.search, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      orderBy: [{ creeLe: 'desc' }],
      take: query?.limit ?? 20,
      skip: query?.offset ?? 0,
      select: {
        ...USER_ME_SELECT,
        _count: {
          select: {
            reservationsClient: true,
            conversationsPrestataire: true,
          },
        },
        profilProfessionnel: {
          select: {
            id: true,
            nomEntreprise: true,
            services: {
              where: { estDisponible: true },
              select: {
                categorie: {
                  select: {
                    nom: true,
                  },
                },
              },
            },
            _count: {
              select: {
                reservations: true,
              },
            },
          },
        },
      },
    });

    return users.map((user) => ({
      ...this.mapUserMe(user),
      nombreReservationsClient: user._count.reservationsClient,
      nombreReservationsPrestataire:
        user.profilProfessionnel?._count.reservations ?? 0,
    }));
  }

  async findAdminUserById(userId: string): Promise<UserMeView | null> {
    return this.findMeById(userId);
  }

  async setUserActiveStatus(
    userId: string,
    isActive: boolean,
  ): Promise<UserMeView | null> {
    try {
      return await this.prisma.$transaction(async (tx) => {
        if (!isActive) {
          await tx.sessionAuthentification.updateMany({
            where: { utilisateurId: userId, revoqueLe: null },
            data: { revoqueLe: new Date() },
          });
        }

        const user = await tx.utilisateur.update({
          where: { id: userId },
          data: {
            estActif: isActive,
            ...(isActive ? {} : { jetonFcm: null }),
          },
          select: USER_ME_SELECT,
        });

        return this.mapUserMe(user);
      });
    } catch (error) {
      const handled = this.handlePrismaError(error, {
        P2025: 'not_found',
      });
      if (handled) {
        return null;
      }
      throw error;
    }
  }

  async getAdminUserHistory(
    userId: string,
    limit: number,
  ): Promise<AdminUserHistoryView | null> {
    const user = await this.prisma.utilisateur.findUnique({
      where: { id: userId },
      select: USER_ME_SELECT,
    });

    if (!user) {
      return null;
    }

    const [
      clientRows,
      professionalProfile,
      paymentsAsClient,
      notificationsCount,
    ] = await this.prisma.$transaction([
      this.prisma.reservation.findMany({
        where: { clientId: userId },
        orderBy: { creeLe: 'desc' },
        take: limit,
        select: {
          id: true,
          statut: true,
          dateHeure: true,
          notes: true,
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
      }),
      this.prisma.profilProfessionnel.findUnique({
        where: { utilisateurId: userId },
        select: { id: true },
      }),
      this.prisma.paiement.findMany({
        where: { clientId: userId },
        orderBy: { creeLe: 'desc' },
        take: limit,
        select: {
          id: true,
          reservationId: true,
          montant: true,
          statut: true,
          creeLe: true,
        },
      }),
      this.prisma.notification.count({
        where: { utilisateurId: userId },
      }),
    ]);

    const [professionalRows, withdrawals] = professionalProfile
      ? await this.prisma.$transaction([
          this.prisma.reservation.findMany({
            where: { professionnelId: professionalProfile.id },
            orderBy: { creeLe: 'desc' },
            take: limit,
            select: {
              id: true,
              statut: true,
              dateHeure: true,
              notes: true,
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
          }),
          this.prisma.demandeRetrait.findMany({
            where: { profilProfessionnelId: professionalProfile.id },
            orderBy: { demandeLe: 'desc' },
            take: limit,
            select: {
              id: true,
              montant: true,
              statut: true,
              demandeLe: true,
            },
          }),
        ])
      : [[], []];

    return {
      user: this.mapUserMe(user),
      reservationsAsClient: clientRows.map((row) =>
        this.mapUserHistoryItem(row),
      ),
      reservationsAsProfessional: professionalRows.map((row) =>
        this.mapUserHistoryItem(row),
      ),
      paymentsAsClient: paymentsAsClient.map((payment) => ({
        id: payment.id,
        bookingId: payment.reservationId,
        amount: Number(payment.montant),
        status: payment.statut,
        createdAt: payment.creeLe,
      })),
      withdrawalsAsProfessional: withdrawals.map((withdrawal) => ({
        id: withdrawal.id,
        amount: Number(withdrawal.montant),
        status: withdrawal.statut,
        requestedAt: withdrawal.demandeLe,
      })),
      notificationsCount,
    };
  }

  async countActiveUsers(): Promise<number> {
    return this.prisma.utilisateur.count({
      where: { estActif: true },
    });
  }
}
