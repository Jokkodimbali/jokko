import { Injectable } from '@nestjs/common';
import { Prisma, type StatutReservation } from '@prisma/client';
import { appHttpException } from '../../../core/http/app-http.exception';
import { PrismaService } from '../../../prisma/prisma.service';
import type { AuthUser } from '../../../auth/security/auth-user.type';
import type { ListAdminProvidersQueryDto } from '../../presentation/dto/list-admin-providers-query.dto';

type ProviderBooking = {
  statut: StatutReservation;
  dateHeure: Date;
  litige: { id: string } | null;
};

@Injectable()
export class AdminProvidersService {
  constructor(private readonly prisma: PrismaService) {}

  async listProviders(
    requestUser: AuthUser,
    query: ListAdminProvidersQueryDto = {},
  ) {
    if (requestUser.role !== 'ADMIN') {
      throw appHttpException('USERS_ADMIN_FORBIDDEN_ROLE');
    }

    const page = query.page ?? 1;
    const limit = query.limit ?? 12;
    const where = this.buildProviderWhere(query);

    const [total, providers] = await this.prisma.$transaction([
      this.prisma.profilProfessionnel.count({ where }),
      this.prisma.profilProfessionnel.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { creeLe: 'desc' },
        select: this.providerListSelect(),
      }),
    ]);

    return {
      items: await this.mapProviderSummaries(providers),
      total,
      page,
      limit,
      stats: await this.computeProviderStats(where, total),
    };
  }

  async getProvider(requestUser: AuthUser, providerId: string) {
    this.assertAdmin(requestUser);
    return this.getProviderDetails(providerId);
  }

  async setProviderActivation(
    requestUser: AuthUser,
    providerId: string,
    active: boolean,
  ) {
    this.assertAdmin(requestUser);

    const provider = await this.prisma.profilProfessionnel.findUnique({
      where: { id: providerId },
      select: { utilisateurId: true },
    });
    if (!provider) {
      throw appHttpException('PROFESSIONALS_PROFILE_NOT_FOUND');
    }

    await this.prisma.utilisateur.update({
      where: { id: provider.utilisateurId },
      data: { estActif: active },
    });

    return this.getProviderDetails(providerId);
  }

  private async getProviderDetails(providerId: string) {
    const provider = await this.prisma.profilProfessionnel.findUnique({
      where: { id: providerId },
      select: {
        id: true,
        utilisateurId: true,
        biographie: true,
        nomEntreprise: true,
        statutKyc: true,
        ville: true,
        noteGlobale: true,
        nombreAvis: true,
        soldePortefeuille: true,
        creeLe: true,
        utilisateur: {
          select: {
            id: true,
            nom: true,
            numeroTelephone: true,
            urlAvatar: true,
            estActif: true,
          },
        },
        services: {
          select: {
            id: true,
            nom: true,
            estDisponible: true,
            categorie: { select: { nom: true } },
          },
          orderBy: { creeLe: 'desc' },
        },
        reservations: {
          select: {
            id: true,
            statut: true,
            dateHeure: true,
            adresseClient: true,
            prixConvenu: true,
            client: { select: { nom: true } },
            service: { select: { nom: true } },
            litige: { select: { id: true } },
          },
          orderBy: { dateHeure: 'desc' },
        },
        diplomesMedicaux: {
          select: {
            id: true,
            titre: true,
            etablissement: true,
            promotion: true,
            statut: true,
            verifieLe: true,
          },
          orderBy: { creeLe: 'desc' },
        },
        elementsPortfolio: {
          select: {
            id: true,
            titre: true,
            urlImage: true,
            creeLe: true,
          },
          orderBy: { creeLe: 'desc' },
          take: 8,
        },
      },
    });

    if (!provider) {
      throw appHttpException('PROFESSIONALS_PROFILE_NOT_FOUND');
    }

    const [summary] = await this.mapProviderSummaries([provider]);
    return {
      ...summary,
      services: provider.services.map((service) => ({
        id: service.id,
        name: service.nom,
        category: service.categorie.nom,
        active: service.estDisponible,
      })),
      recentReservations: provider.reservations
        .slice(0, 8)
        .map((reservation) => ({
          id: reservation.id,
          status: reservation.statut,
          scheduledAt: reservation.dateHeure,
          address: reservation.adresseClient,
          price: reservation.prixConvenu?.toNumber() ?? null,
          clientName: reservation.client.nom,
          serviceName: reservation.service.nom,
          hasDispute: Boolean(reservation.litige),
        })),
      medicalCredentials: provider.diplomesMedicaux.map((credential) => ({
        id: credential.id,
        title: credential.titre,
        institution: credential.etablissement,
        graduationYear: credential.promotion,
        status: credential.statut,
        verifiedAt: credential.verifieLe,
      })),
      portfolio: provider.elementsPortfolio.map((item) => ({
        id: item.id,
        title: item.titre,
        imageUrl: item.urlImage,
        createdAt: item.creeLe,
      })),
    };
  }

  private async mapProviderSummaries<
    TProvider extends {
      id: string;
      utilisateurId: string;
      biographie: string | null;
      nomEntreprise: string | null;
      statutKyc: string;
      ville: string | null;
      noteGlobale: { toNumber(): number };
      nombreAvis: number;
      soldePortefeuille: { toNumber(): number };
      creeLe: Date;
      utilisateur: {
        id: string;
        nom: string;
        numeroTelephone: string;
        urlAvatar: string | null;
        estActif: boolean;
      };
      services: Array<{
        id: string;
        nom: string;
        estDisponible: boolean;
        categorie: { nom: string };
      }>;
      reservations: ProviderBooking[];
    },
  >(providers: TProvider[]) {
    const providerIds = providers.map((provider) => provider.id);
    const paymentGroups =
      providerIds.length === 0
        ? []
        : await this.prisma.paiement.groupBy({
            by: ['professionalId'],
            where: {
              professionalId: { in: providerIds },
              statut: 'SUCCES',
            },
            _sum: {
              montant: true,
              montantNet: true,
            },
          });

    const paymentsByProvider = new Map(
      paymentGroups.map((payment) => [
        payment.professionalId,
        {
          gross: Number(payment._sum.montant ?? 0),
          net: Number(payment._sum.montantNet ?? 0),
        },
      ]),
    );

    return providers.map((provider) => {
      const reservations = provider.reservations;
      const services = provider.services;
      const payments = paymentsByProvider.get(provider.id) ?? {
        gross: 0,
        net: 0,
      };

      return {
        id: provider.id,
        userId: provider.utilisateurId,
        name: provider.utilisateur.nom,
        companyName: provider.nomEntreprise,
        phone: provider.utilisateur.numeroTelephone,
        avatarUrl: provider.utilisateur.urlAvatar,
        city: provider.ville,
        bio: provider.biographie,
        kycStatus: provider.statutKyc,
        active: provider.utilisateur.estActif,
        rating: provider.noteGlobale.toNumber(),
        reviewsCount: provider.nombreAvis,
        walletBalance: provider.soldePortefeuille.toNumber(),
        createdAt: provider.creeLe,
        servicesCount: services.length,
        activeServicesCount: services.filter((service) => service.estDisponible)
          .length,
        reservationsCount: reservations.length,
        completedReservationsCount: this.countReservations(reservations, [
          'TERMINEE',
        ]),
        activeReservationsCount: this.countReservations(reservations, [
          'EN_ATTENTE',
          'CONFIRMEE',
          'PAYEE_SEQUESTRE',
          'EN_COURS',
        ]),
        disputesCount: reservations.filter((reservation) => reservation.litige)
          .length,
        revenueGross: payments.gross,
        revenueNet: payments.net,
        mainCategories: this.resolveMainCategories(services),
        lastBookingAt: reservations[0]?.dateHeure ?? null,
      };
    });
  }

  private providerListSelect() {
    return {
      id: true,
      utilisateurId: true,
      biographie: true,
      nomEntreprise: true,
      statutKyc: true,
      ville: true,
      noteGlobale: true,
      nombreAvis: true,
      soldePortefeuille: true,
      creeLe: true,
      utilisateur: {
        select: {
          id: true,
          nom: true,
          numeroTelephone: true,
          urlAvatar: true,
          estActif: true,
        },
      },
      services: {
        select: {
          id: true,
          nom: true,
          estDisponible: true,
          categorie: { select: { nom: true } },
        },
        orderBy: { creeLe: 'desc' },
      },
      reservations: {
        select: {
          statut: true,
          dateHeure: true,
          litige: { select: { id: true } },
        },
        orderBy: { dateHeure: 'desc' },
      },
    } satisfies Prisma.ProfilProfessionnelSelect;
  }

  private buildProviderWhere(
    query: ListAdminProvidersQueryDto,
  ): Prisma.ProfilProfessionnelWhereInput {
    const search = query.search?.trim();
    return {
      statutKyc: query.kycStatus,
      utilisateur: {
        role: 'PRESTATAIRE',
        estActif: query.active,
      },
      ...(search
        ? {
            OR: [
              { nomEntreprise: { contains: search, mode: 'insensitive' } },
              { ville: { contains: search, mode: 'insensitive' } },
              {
                utilisateur: { nom: { contains: search, mode: 'insensitive' } },
              },
              {
                utilisateur: {
                  numeroTelephone: { contains: search, mode: 'insensitive' },
                },
              },
            ],
          }
        : {}),
    };
  }

  private async computeProviderStats(
    where: Prisma.ProfilProfessionnelWhereInput,
    totalProviders: number,
  ) {
    const matchingProviders = await this.prisma.profilProfessionnel.findMany({
      where,
      select: { id: true },
    });
    const providerIds = matchingProviders.map((provider) => provider.id);

    if (providerIds.length === 0) {
      return {
        totalProviders,
        verifiedCount: 0,
        activeCount: 0,
        reservationsCount: 0,
        revenueGross: 0,
        revenueNet: 0,
      };
    }

    const [verifiedCount, activeCount, reservationsCount, paymentTotals] =
      await this.prisma.$transaction([
        this.prisma.profilProfessionnel.count({
          where: { id: { in: providerIds }, statutKyc: 'VERIFIE' },
        }),
        this.prisma.profilProfessionnel.count({
          where: {
            id: { in: providerIds },
            utilisateur: { estActif: true },
          },
        }),
        this.prisma.reservation.count({
          where: { professionnelId: { in: providerIds } },
        }),
        this.prisma.paiement.aggregate({
          where: {
            professionalId: { in: providerIds },
            statut: 'SUCCES',
          },
          _sum: {
            montant: true,
            montantNet: true,
          },
        }),
      ]);

    return {
      totalProviders,
      verifiedCount,
      activeCount,
      reservationsCount,
      revenueGross: Number(paymentTotals._sum.montant ?? 0),
      revenueNet: Number(paymentTotals._sum.montantNet ?? 0),
    };
  }

  private assertAdmin(requestUser: AuthUser): void {
    if (requestUser.role !== 'ADMIN') {
      throw appHttpException('USERS_ADMIN_FORBIDDEN_ROLE');
    }
  }

  private countReservations(
    reservations: ProviderBooking[],
    statuses: StatutReservation[],
  ): number {
    return reservations.filter((reservation) =>
      statuses.includes(reservation.statut),
    ).length;
  }

  private resolveMainCategories(
    services: Array<{ categorie: { nom: string } }>,
  ): string[] {
    return Array.from(
      new Set(services.map((service) => service.categorie.nom)),
    ).slice(0, 3);
  }
}
