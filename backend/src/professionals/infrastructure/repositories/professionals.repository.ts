import { Injectable } from '@nestjs/common';
import { Prisma, RoleUtilisateur, StatutKyc } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import type {
  CreateAvailabilityInput,
  CreateAvailabilityResult,
  CreateProfessionalProfileInput,
  CreateProfessionalProfileResult,
  CreatePortfolioItemInput,
  CreatePortfolioItemResult,
  CreateServiceInput,
  CreateServiceResult,
  DeletePortfolioItemResult,
  DisableAvailabilityResult,
  DisableServiceResult,
  ProfessionalAvailabilityView,
  ProfessionalProfileView,
  ProfessionalPortfolioItemView,
  ProfessionalReviewView,
  ProfessionalServiceView,
  ProfessionalsRepositoryPort,
  SubmitKycInput,
  SubmitKycResult,
  UpdateServiceInput,
  UpdateServiceResult,
  UpdateProfessionalProfileInput,
  UpdateProfessionalProfileResult,
} from '../../application/ports/professionals-repository.port';

type RawProfessionalProfile = {
  id: string;
  utilisateurId: string;
  biographie: string | null;
  nomEntreprise: string | null;
  urlPieceIdentite: string | null;
  statutKyc: StatutKyc;
  raisonRejetKyc: string | null;
  ville: string | null;
  noteGlobale: Prisma.Decimal;
  nombreAvis: number;
  creeLe: Date;
  utilisateur: {
    id: string;
    nom: string;
    numeroTelephone: string;
    urlAvatar: string | null;
    estActif: boolean;
  };
};

@Injectable()
export class ProfessionalsRepository implements ProfessionalsRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  private readonly professionalSelect = {
    id: true,
    utilisateurId: true,
    biographie: true,
    nomEntreprise: true,
    urlPieceIdentite: true,
    statutKyc: true,
    raisonRejetKyc: true,
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
  } as const;

  async createProfile(
    input: CreateProfessionalProfileInput,
  ): Promise<CreateProfessionalProfileResult> {
    try {
      const profile = await this.prisma.profilProfessionnel.create({
        data: {
          utilisateurId: input.utilisateurId,
          biographie: input.biographie,
          nomEntreprise: input.nomEntreprise,
          ville: input.ville,
        },
        select: this.professionalSelect,
      });
      return { status: 'created', profile: this.mapProfile(profile) };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        return { status: 'already_exists' };
      }
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2003'
      ) {
        return { status: 'user_not_found' };
      }
      throw error;
    }
  }

  async findByUserId(userId: string) {
    const profile = await this.prisma.profilProfessionnel.findUnique({
      where: { utilisateurId: userId },
      select: this.professionalSelect,
    });
    return profile ? this.mapProfile(profile) : null;
  }

  async updateProfile(
    input: UpdateProfessionalProfileInput,
  ): Promise<UpdateProfessionalProfileResult> {
    try {
      const profile = await this.prisma.profilProfessionnel.update({
        where: { utilisateurId: input.utilisateurId },
        data: {
          biographie: input.biographie,
          nomEntreprise: input.nomEntreprise,
          ville: input.ville,
        },
        select: this.professionalSelect,
      });
      return { status: 'updated', profile: this.mapProfile(profile) };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        return { status: 'profile_not_found' };
      }
      throw error;
    }
  }

  async submitKyc(input: SubmitKycInput): Promise<SubmitKycResult> {
    try {
      const profile = await this.prisma.profilProfessionnel.update({
        where: { utilisateurId: input.utilisateurId },
        data: {
          urlPieceIdentite: input.idCardUrl,
          statutKyc: StatutKyc.EN_ATTENTE,
          raisonRejetKyc: null,
        },
        select: this.professionalSelect,
      });
      return { status: 'updated', profile: this.mapProfile(profile) };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        return { status: 'profile_not_found' };
      }
      throw error;
    }
  }

  async approveKyc(profileId: string) {
    try {
      const profile = await this.prisma.profilProfessionnel.update({
        where: { id: profileId },
        data: {
          statutKyc: StatutKyc.VERIFIE,
          raisonRejetKyc: null,
        },
        select: this.professionalSelect,
      });
      return this.mapProfile(profile);
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

  async rejectKyc(profileId: string, reason: string) {
    try {
      const profile = await this.prisma.profilProfessionnel.update({
        where: { id: profileId },
        data: {
          statutKyc: StatutKyc.REJETE,
          raisonRejetKyc: reason,
        },
        select: this.professionalSelect,
      });
      return this.mapProfile(profile);
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

  async findVerifiedById(profileId: string) {
    const profile = await this.prisma.profilProfessionnel.findFirst({
      where: {
        id: profileId,
        statutKyc: StatutKyc.VERIFIE,
        utilisateur: {
          estActif: true,
          role: RoleUtilisateur.PRESTATAIRE,
        },
      },
      select: this.professionalSelect,
    });
    return profile ? this.mapProfile(profile) : null;
  }

  async listVerified(query: { city?: string; limit: number }) {
    const profiles = await this.prisma.profilProfessionnel.findMany({
      where: {
        statutKyc: StatutKyc.VERIFIE,
        utilisateur: {
          estActif: true,
          role: RoleUtilisateur.PRESTATAIRE,
        },
        ...(query.city
          ? { ville: { equals: query.city, mode: 'insensitive' } }
          : {}),
      },
      orderBy: [
        { noteGlobale: 'desc' },
        { nombreAvis: 'desc' },
        { creeLe: 'desc' },
      ],
      take: query.limit,
      select: this.professionalSelect,
    });

    return profiles.map((profile) => this.mapProfile(profile));
  }

  async listServices(profileId: string): Promise<ProfessionalServiceView[]> {
    const services = await this.prisma.service.findMany({
      where: {
        profilProfessionnelId: profileId,
        estDisponible: true,
      },
      orderBy: { creeLe: 'desc' },
      select: {
        id: true,
        nom: true,
        description: true,
        prix: true,
        typePrix: true,
        estDisponible: true,
        creeLe: true,
      },
    });

    return services.map((service) => ({
      id: service.id,
      nom: service.nom,
      description: service.description,
      prix: service.prix.toNumber(),
      typePrix: service.typePrix,
      estDisponible: service.estDisponible,
      creeLe: service.creeLe,
    }));
  }

  async listPortfolio(
    profileId: string,
  ): Promise<ProfessionalPortfolioItemView[]> {
    return this.prisma.elementPortfolio.findMany({
      where: { profilProfessionnelId: profileId },
      orderBy: { creeLe: 'desc' },
      select: {
        id: true,
        titre: true,
        description: true,
        urlImage: true,
        creeLe: true,
      },
    });
  }

  async listAvailabilities(
    profileId: string,
  ): Promise<ProfessionalAvailabilityView[]> {
    return this.prisma.disponibilite.findMany({
      where: { profilProfessionnelId: profileId, estActive: true },
      orderBy: [{ jourSemaine: 'asc' }, { heureDebut: 'asc' }],
      select: {
        id: true,
        jourSemaine: true,
        heureDebut: true,
        heureFin: true,
        estActive: true,
      },
    });
  }

  async listReviews(profileId: string): Promise<ProfessionalReviewView[]> {
    const rows = await this.prisma.reservation.findMany({
      where: {
        service: {
          profilProfessionnelId: profileId,
        },
        noteClient: {
          not: null,
        },
      },
      orderBy: { creeLe: 'desc' },
      select: {
        id: true,
        noteClient: true,
        avisClient: true,
        planifieeLe: true,
        creeLe: true,
        service: {
          select: {
            id: true,
            nom: true,
          },
        },
        client: {
          select: {
            id: true,
            nom: true,
            urlAvatar: true,
          },
        },
      },
    });

    return rows
      .filter(
        (row): row is typeof row & { noteClient: number } =>
          row.noteClient !== null,
      )
      .map((row) => ({
        id: row.id,
        noteClient: row.noteClient,
        avisClient: row.avisClient,
        planifieeLe: row.planifieeLe,
        creeLe: row.creeLe,
        service: {
          id: row.service.id,
          nom: row.service.nom,
        },
        client: {
          id: row.client.id,
          nom: row.client.nom,
          urlAvatar: row.client.urlAvatar,
        },
      }));
  }

  async createService(input: CreateServiceInput): Promise<CreateServiceResult> {
    const profile = await this.prisma.profilProfessionnel.findUnique({
      where: { utilisateurId: input.utilisateurId },
      select: { id: true },
    });
    if (!profile) {
      return { status: 'profile_not_found' };
    }

    try {
      const service = await this.prisma.service.create({
        data: {
          profilProfessionnelId: profile.id,
          categorieId: input.categoryId,
          nom: input.name,
          description: input.description,
          prix: input.price,
          typePrix: input.priceType,
        },
        select: {
          id: true,
          nom: true,
          description: true,
          prix: true,
          typePrix: true,
          estDisponible: true,
          creeLe: true,
        },
      });
      return {
        status: 'created',
        service: {
          id: service.id,
          nom: service.nom,
          description: service.description,
          prix: service.prix.toNumber(),
          typePrix: service.typePrix,
          estDisponible: service.estDisponible,
          creeLe: service.creeLe,
        },
      };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2003'
      ) {
        return { status: 'category_not_found' };
      }
      throw error;
    }
  }

  async updateService(input: UpdateServiceInput): Promise<UpdateServiceResult> {
    const profile = await this.prisma.profilProfessionnel.findUnique({
      where: { utilisateurId: input.utilisateurId },
      select: { id: true },
    });
    if (!profile) {
      return { status: 'profile_not_found' };
    }

    const updated = await this.prisma.service.updateMany({
      where: {
        id: input.serviceId,
        profilProfessionnelId: profile.id,
      },
      data: {
        nom: input.name,
        description: input.description,
        prix: input.price,
        typePrix: input.priceType,
      },
    });
    if (updated.count === 0) {
      return { status: 'service_not_found' };
    }

    const service = await this.prisma.service.findUnique({
      where: { id: input.serviceId },
      select: {
        id: true,
        nom: true,
        description: true,
        prix: true,
        typePrix: true,
        estDisponible: true,
        creeLe: true,
      },
    });
    if (!service) {
      return { status: 'service_not_found' };
    }

    return {
      status: 'updated',
      service: {
        id: service.id,
        nom: service.nom,
        description: service.description,
        prix: service.prix.toNumber(),
        typePrix: service.typePrix,
        estDisponible: service.estDisponible,
        creeLe: service.creeLe,
      },
    };
  }

  async disableService(
    utilisateurId: string,
    serviceId: string,
  ): Promise<DisableServiceResult> {
    const profile = await this.prisma.profilProfessionnel.findUnique({
      where: { utilisateurId },
      select: { id: true },
    });
    if (!profile) {
      return { status: 'profile_not_found' };
    }

    const updated = await this.prisma.service.updateMany({
      where: { id: serviceId, profilProfessionnelId: profile.id },
      data: { estDisponible: false },
    });
    if (updated.count === 0) {
      return { status: 'service_not_found' };
    }

    const service = await this.prisma.service.findUnique({
      where: { id: serviceId },
      select: {
        id: true,
        nom: true,
        description: true,
        prix: true,
        typePrix: true,
        estDisponible: true,
        creeLe: true,
      },
    });
    if (!service) {
      return { status: 'service_not_found' };
    }

    return {
      status: 'disabled',
      service: {
        id: service.id,
        nom: service.nom,
        description: service.description,
        prix: service.prix.toNumber(),
        typePrix: service.typePrix,
        estDisponible: service.estDisponible,
        creeLe: service.creeLe,
      },
    };
  }

  async createPortfolioItem(
    input: CreatePortfolioItemInput,
  ): Promise<CreatePortfolioItemResult> {
    const profile = await this.prisma.profilProfessionnel.findUnique({
      where: { utilisateurId: input.utilisateurId },
      select: { id: true },
    });
    if (!profile) {
      return { status: 'profile_not_found' };
    }

    const item = await this.prisma.elementPortfolio.create({
      data: {
        profilProfessionnelId: profile.id,
        titre: input.title,
        description: input.description ?? null,
        urlImage: input.imageUrl,
      },
      select: {
        id: true,
        titre: true,
        description: true,
        urlImage: true,
        creeLe: true,
      },
    });
    return { status: 'created', item };
  }

  async deletePortfolioItem(
    utilisateurId: string,
    itemId: string,
  ): Promise<DeletePortfolioItemResult> {
    const profile = await this.prisma.profilProfessionnel.findUnique({
      where: { utilisateurId },
      select: { id: true },
    });
    if (!profile) {
      return { status: 'profile_not_found' };
    }

    const deleted = await this.prisma.elementPortfolio.deleteMany({
      where: { id: itemId, profilProfessionnelId: profile.id },
    });
    if (deleted.count === 0) {
      return { status: 'item_not_found' };
    }
    return { status: 'deleted' };
  }

  async createAvailability(
    input: CreateAvailabilityInput,
  ): Promise<CreateAvailabilityResult> {
    const profile = await this.prisma.profilProfessionnel.findUnique({
      where: { utilisateurId: input.utilisateurId },
      select: { id: true },
    });
    if (!profile) {
      return { status: 'profile_not_found' };
    }

    const availability = await this.prisma.disponibilite.create({
      data: {
        profilProfessionnelId: profile.id,
        jourSemaine: input.dayOfWeek,
        heureDebut: input.startTime,
        heureFin: input.endTime,
      },
      select: {
        id: true,
        jourSemaine: true,
        heureDebut: true,
        heureFin: true,
        estActive: true,
      },
    });
    return { status: 'created', availability };
  }

  async disableAvailability(
    utilisateurId: string,
    availabilityId: string,
  ): Promise<DisableAvailabilityResult> {
    const profile = await this.prisma.profilProfessionnel.findUnique({
      where: { utilisateurId },
      select: { id: true },
    });
    if (!profile) {
      return { status: 'profile_not_found' };
    }

    const updated = await this.prisma.disponibilite.updateMany({
      where: {
        id: availabilityId,
        profilProfessionnelId: profile.id,
      },
      data: { estActive: false },
    });
    if (updated.count === 0) {
      return { status: 'availability_not_found' };
    }

    const availability = await this.prisma.disponibilite.findUnique({
      where: { id: availabilityId },
      select: {
        id: true,
        jourSemaine: true,
        heureDebut: true,
        heureFin: true,
        estActive: true,
      },
    });
    if (!availability) {
      return { status: 'availability_not_found' };
    }
    return { status: 'disabled', availability };
  }

  private mapProfile(profile: RawProfessionalProfile): ProfessionalProfileView {
    return {
      id: profile.id,
      utilisateurId: profile.utilisateurId,
      biographie: profile.biographie,
      nomEntreprise: profile.nomEntreprise,
      urlPieceIdentite: profile.urlPieceIdentite,
      statutKyc: profile.statutKyc,
      raisonRejetKyc: profile.raisonRejetKyc,
      ville: profile.ville,
      noteGlobale: profile.noteGlobale.toNumber(),
      nombreAvis: profile.nombreAvis,
      creeLe: profile.creeLe,
      utilisateur: {
        id: profile.utilisateur.id,
        nom: profile.utilisateur.nom,
        numeroTelephone: profile.utilisateur.numeroTelephone,
        urlAvatar: profile.utilisateur.urlAvatar,
        estActif: profile.utilisateur.estActif,
      },
    };
  }
}
