import { Injectable } from '@nestjs/common';
import {
  Prisma,
  StatutKyc,
  StatutPresenceProfessionnel,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { appHttpException } from '../../core/http/app-http.exception';

const FAVORITE_SELECT = {
  id: true,
  creeLe: true,
  profilProfessionnel: {
    select: {
      id: true,
      nomEntreprise: true,
      biographie: true,
      ville: true,
      noteGlobale: true,
      nombreAvis: true,
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
        where: { estDisponible: true },
        orderBy: { creeLe: 'desc' },
        take: 1,
        select: {
          id: true,
          nom: true,
          prix: true,
          typePrix: true,
          categorie: {
            select: {
              id: true,
              nom: true,
            },
          },
        },
      },
      disponibilites: {
        where: { estActive: true },
        select: {
          jourSemaine: true,
          heureDebut: true,
          heureFin: true,
        },
      },
      elementsPortfolio: {
        orderBy: { creeLe: 'desc' },
        take: 2,
        select: {
          id: true,
          titre: true,
          urlImage: true,
        },
      },
      presence: {
        select: {
          estEnLigne: true,
          statut: true,
          dernierVueLe: true,
        },
      },
    },
  },
} as const;

type RawFavorite = Prisma.FavoriProfessionnelGetPayload<{
  select: typeof FAVORITE_SELECT;
}>;

@Injectable()
export class FavoritesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string) {
    const favorites = await this.prisma.favoriProfessionnel.findMany({
      where: { utilisateurId: userId },
      orderBy: { creeLe: 'desc' },
      select: FAVORITE_SELECT,
    });

    return favorites.map((favorite) => this.mapFavorite(favorite));
  }

  async status(userId: string, professionalId: string) {
    const favorite = await this.prisma.favoriProfessionnel.findUnique({
      where: {
        utilisateurId_profilProfessionnelId: {
          utilisateurId: userId,
          profilProfessionnelId: professionalId,
        },
      },
      select: { id: true },
    });

    return { professionalId, isFavorite: Boolean(favorite) };
  }

  async add(userId: string, professionalId: string) {
    await this.assertProfessionalCanBeFavorited(professionalId);

    try {
      const favorite = await this.prisma.favoriProfessionnel.upsert({
        where: {
          utilisateurId_profilProfessionnelId: {
            utilisateurId: userId,
            profilProfessionnelId: professionalId,
          },
        },
        create: {
          utilisateurId: userId,
          profilProfessionnelId: professionalId,
        },
        update: {},
        select: FAVORITE_SELECT,
      });

      return this.mapFavorite(favorite);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2003'
      ) {
        throw appHttpException('PROFESSIONALS_PROFILE_NOT_FOUND');
      }

      throw error;
    }
  }

  async remove(userId: string, professionalId: string) {
    await this.prisma.favoriProfessionnel.deleteMany({
      where: {
        utilisateurId: userId,
        profilProfessionnelId: professionalId,
      },
    });

    return { professionalId, isFavorite: false };
  }

  private async assertProfessionalCanBeFavorited(professionalId: string) {
    const professional = await this.prisma.profilProfessionnel.findFirst({
      where: {
        id: professionalId,
        statutKyc: StatutKyc.VERIFIE,
        utilisateur: {
          estActif: true,
        },
      },
      select: { id: true },
    });

    if (!professional) {
      throw appHttpException('PROFESSIONALS_PROFILE_NOT_FOUND');
    }
  }

  private mapFavorite(favorite: RawFavorite) {
    const professional = favorite.profilProfessionnel;
    const primaryService = professional.services[0] ?? null;
    const presence = professional.presence;
    const now = new Date();
    const today = now.getDay() === 0 ? 7 : now.getDay();
    const hasAvailabilityToday = professional.disponibilites.some(
      (availability) => availability.jourSemaine === today,
    );
    const isOnline =
      Boolean(presence?.estEnLigne) &&
      presence?.statut !== StatutPresenceProfessionnel.HORS_LIGNE;

    return {
      id: favorite.id,
      professionalId: professional.id,
      createdAt: favorite.creeLe,
      name: professional.nomEntreprise || professional.utilisateur.nom,
      subtitle:
        primaryService?.categorie.nom || primaryService?.nom || 'Prestataire',
      location: professional.ville || 'Senegal',
      avatarUrl: professional.utilisateur.urlAvatar,
      rating: professional.noteGlobale.toNumber(),
      totalReviews: professional.nombreAvis,
      isOnline,
      presenceStatus: presence?.statut ?? StatutPresenceProfessionnel.HORS_LIGNE,
      lastSeenAt: presence?.dernierVueLe ?? null,
      isAvailableToday: hasAvailabilityToday,
      isNew: this.daysBetween(professional.creeLe, now) <= 30,
      portfolioImages: professional.elementsPortfolio.map((item) => ({
        id: item.id,
        title: item.titre,
        url: item.urlImage,
      })),
      service: primaryService
        ? {
            id: primaryService.id,
            name: primaryService.nom,
            price: primaryService.prix.toNumber(),
            priceType: primaryService.typePrix,
            categoryId: primaryService.categorie.id,
            categoryName: primaryService.categorie.nom,
          }
        : null,
    };
  }

  private daysBetween(start: Date, end: Date) {
    return Math.floor((end.getTime() - start.getTime()) / 86_400_000);
  }
}
