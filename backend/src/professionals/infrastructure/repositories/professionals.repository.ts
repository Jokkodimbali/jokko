import { Injectable } from '@nestjs/common';
import { Prisma, StatutKyc } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import type {
  AdminKycProfileView,
  // Profile types
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
  UpdateAvailabilityInput,
  UpdateAvailabilityResult,
  UpdateServiceInput,
  UpdateServiceResult,
  UpdateProfessionalProfileInput,
  UpdateProfessionalProfileResult,
  ApproveKycResult,
  RejectKycResult,
} from '../../application/ports/professionals-repository.port';

// ─── Prisma Select Constants (DRY) ───────────────────────────────────────────

const PROFESSIONAL_SELECT = {
  id: true,
  utilisateurId: true,
  biographie: true,
  nomEntreprise: true,
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

const ADMIN_KYC_SELECT = {
  ...PROFESSIONAL_SELECT,
  urlPieceIdentiteRecto: true,
  urlPieceIdentiteVerso: true,
} as const;

const SERVICE_SELECT = {
  id: true,
  profilProfessionnelId: true,
  categorieId: true,
  nom: true,
  description: true,
  prix: true,
  typePrix: true,
  modeDeplacement: true,
  dureeMinutes: true,
  estObligatoire: true,
  estDisponible: true,
  creeLe: true,
} as const;

const PORTFOLIO_SELECT = {
  id: true,
  titre: true,
  description: true,
  urlImage: true,
  creeLe: true,
} as const;

const AVAILABILITY_SELECT = {
  id: true,
  jourSemaine: true,
  heureDebut: true,
  heureFin: true,
  estActive: true,
} as const;

type RawProfessionalProfile = {
  id: string;
  utilisateurId: string;
  biographie: string | null;
  nomEntreprise: string | null;
  urlPieceIdentiteRecto?: string | null;
  urlPieceIdentiteVerso?: string | null;
  statutKyc: StatutKyc;
  raisonRejetKyc: string | null;
  ville: string | null;
  latitude?: number | null;
  longitude?: number | null;
  noteGlobale: Prisma.Decimal;
  nombreAvis: number;
  creeLe: Date;
  utilisateur?: {
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

  // ─── Helper Methods (DRY) ──────────────────────────────────────────────────

  private async getProfileIdByUserId(
    utilisateurId: string,
  ): Promise<string | null> {
    const profile = await this.prisma.profilProfessionnel.findUnique({
      where: { utilisateurId },
      select: { id: true },
    });
    return profile?.id ?? null;
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

  private mapService(service: {
    id: string;
    profilProfessionnelId: string;
    categorieId: string;
    nom: string;
    description: string;
    prix: Prisma.Decimal;
    typePrix: string;
    modeDeplacement: string;
    dureeMinutes: number;
    estObligatoire: boolean;
    estDisponible: boolean;
    creeLe: Date;
  }): ProfessionalServiceView {
    return {
      id: service.id,
      profilProfessionnelId: service.profilProfessionnelId,
      categorieId: service.categorieId,
      nom: service.nom,
      description: service.description,
      prix: service.prix.toNumber(),
      typePrix: service.typePrix as ProfessionalServiceView['typePrix'],
      modeDeplacement:
        service.modeDeplacement as ProfessionalServiceView['modeDeplacement'],
      dureeMinutes: service.dureeMinutes,
      estObligatoire: service.estObligatoire,
      estDisponible: service.estDisponible,
      creeLe: service.creeLe,
    };
  }

  // ─── Profile Operations ────────────────────────────────────────────────────

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
        select: PROFESSIONAL_SELECT,
      });
      return { status: 'created', profile: this.mapProfile(profile) };
    } catch (error) {
      const handled = this.handlePrismaError<CreateProfessionalProfileResult>(
        error,
        {
          P2002: 'already_exists',
          P2003: 'user_not_found',
        },
      );
      if (handled) return handled;
      throw error;
    }
  }

  async findByUserId(userId: string) {
    const profile = await this.prisma.profilProfessionnel.findUnique({
      where: { utilisateurId: userId },
      select: PROFESSIONAL_SELECT,
    });
    if (!profile) return null;

    const coordinates = await this.getProfileCoordinates(profile.id);
    return this.mapProfile({ ...profile, ...coordinates });
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
        select: PROFESSIONAL_SELECT,
      });
      return { status: 'updated', profile: this.mapProfile(profile) };
    } catch (error) {
      const handled = this.handlePrismaError<UpdateProfessionalProfileResult>(
        error,
        {
          P2025: 'profile_not_found',
        },
      );
      if (handled) return handled;
      throw error;
    }
  }

  async submitKyc(input: SubmitKycInput): Promise<SubmitKycResult> {
    try {
      const profile = await this.prisma.profilProfessionnel.update({
        where: { utilisateurId: input.utilisateurId },
        data: {
          urlPieceIdentiteRecto: input.idCardUrlRecto,
          urlPieceIdentiteVerso: input.idCardUrlVerso,
          statutKyc: StatutKyc.EN_ATTENTE,
          raisonRejetKyc: null,
        },
        select: PROFESSIONAL_SELECT,
      });
      return { status: 'updated', profile: this.mapProfile(profile) };
    } catch (error) {
      const handled = this.handlePrismaError<SubmitKycResult>(error, {
        P2025: 'profile_not_found',
      });
      if (handled) return handled;
      throw error;
    }
  }

  async approveKyc(profileId: string): Promise<ApproveKycResult> {
    try {
      const profile = await this.prisma.profilProfessionnel.update({
        where: { id: profileId },
        data: {
          statutKyc: StatutKyc.VERIFIE,
          raisonRejetKyc: null,
        },
        select: PROFESSIONAL_SELECT,
      });
      return { status: 'approved', profile: this.mapProfile(profile) };
    } catch (error) {
      const handled = this.handlePrismaError<ApproveKycResult>(error, {
        P2025: 'profile_not_found',
      });
      if (handled) return handled;
      throw error;
    }
  }

  async rejectKyc(profileId: string, reason: string): Promise<RejectKycResult> {
    try {
      const profile = await this.prisma.profilProfessionnel.update({
        where: { id: profileId },
        data: {
          statutKyc: StatutKyc.REJETE,
          raisonRejetKyc: reason,
        },
        select: PROFESSIONAL_SELECT,
      });
      return { status: 'rejected', profile: this.mapProfile(profile) };
    } catch (error) {
      const handled = this.handlePrismaError<RejectKycResult>(error, {
        P2025: 'profile_not_found',
      });
      if (handled) return handled;
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
          role: { in: ['PRESTATAIRE', 'MEDECIN'] },
        },
      },
      select: PROFESSIONAL_SELECT,
    });
    if (!profile) return null;

    const coordinates = await this.getProfileCoordinates(profile.id);
    return this.mapProfile({ ...profile, ...coordinates });
  }

  async findPublicById(profileId: string) {
    const profile = await this.prisma.profilProfessionnel.findFirst({
      where: {
        id: profileId,
        OR: [
          {
            statutKyc: StatutKyc.VERIFIE,
            utilisateur: {
              estActif: true,
              role: 'MEDECIN',
            },
          },
          {
            statutKyc: StatutKyc.VERIFIE,
            services: {
              some: {
                estDisponible: true,
              },
            },
            utilisateur: {
              estActif: true,
              role: 'PRESTATAIRE',
            },
          },
        ],
      },
      select: PROFESSIONAL_SELECT,
    });
    if (!profile) return null;

    const coordinates = await this.getProfileCoordinates(profile.id);
    return this.mapProfile({ ...profile, ...coordinates });
  }

  async listKycForAdmin(query?: {
    status?: StatutKyc;
    limit?: number;
    offset?: number;
    search?: string;
  }): Promise<AdminKycProfileView[]> {
    const profiles = await this.prisma.profilProfessionnel.findMany({
      where: this.buildAdminKycWhere(query),
      orderBy: [{ creeLe: 'desc' }],
      take: query?.limit ?? 20,
      skip: query?.offset ?? 0,
      select: ADMIN_KYC_SELECT,
    });

    return profiles.map((profile) => this.mapAdminKycProfile(profile));
  }

  async countKycForAdmin(query?: {
    status?: StatutKyc;
    search?: string;
  }): Promise<number> {
    return this.prisma.profilProfessionnel.count({
      where: this.buildAdminKycWhere(query),
    });
  }

  private buildAdminKycWhere(query?: {
    status?: StatutKyc;
    search?: string;
  }): Prisma.ProfilProfessionnelWhereInput {
    const search = query?.search?.trim();
    return {
      ...(query?.status ? { statutKyc: query.status } : {}),
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

  async findKycByIdForAdmin(
    profileId: string,
  ): Promise<AdminKycProfileView | null> {
    const profile = await this.prisma.profilProfessionnel.findUnique({
      where: { id: profileId },
      select: ADMIN_KYC_SELECT,
    });

    return profile ? this.mapAdminKycProfile(profile) : null;
  }

  // ─── Service Operations ────────────────────────────────────────────────────

  async getServiceById(
    serviceId: string,
  ): Promise<ProfessionalServiceView | null> {
    const service = await this.prisma.service.findUnique({
      where: { id: serviceId },
      select: SERVICE_SELECT,
    });

    if (!service) return null;
    return this.mapService(service);
  }

  async listServices(profileId: string): Promise<ProfessionalServiceView[]> {
    const services = await this.prisma.service.findMany({
      where: {
        profilProfessionnelId: profileId,
        estDisponible: true,
      },
      orderBy: { creeLe: 'desc' },
      select: SERVICE_SELECT,
    });

    return services.map((s) => this.mapService(s));
  }

  async createService(input: CreateServiceInput): Promise<CreateServiceResult> {
    const profileId = await this.getProfileIdByUserId(input.utilisateurId);
    if (!profileId) {
      return { status: 'profile_not_found' };
    }

    try {
      const service = await this.prisma.service.create({
        data: {
          profilProfessionnelId: profileId,
          categorieId: input.categoryId,
          nom: input.name,
          description: input.description,
          prix: input.price,
          typePrix: input.priceType,
          modeDeplacement: input.travelMode,
          dureeMinutes: input.durationMinutes,
          estObligatoire: input.isRequired,
        },
        select: SERVICE_SELECT,
      });
      return { status: 'created', service: this.mapService(service) };
    } catch (error) {
      const handled = this.handlePrismaError<CreateServiceResult>(error, {
        P2003: 'category_not_found',
      });
      if (handled) return handled;
      throw error;
    }
  }

  async updateService(input: UpdateServiceInput): Promise<UpdateServiceResult> {
    const profileId = await this.getProfileIdByUserId(input.utilisateurId);
    if (!profileId) {
      return { status: 'profile_not_found' };
    }

    try {
      const service = await this.prisma.service.update({
        where: {
          id: input.serviceId,
          profilProfessionnelId: profileId,
        },
        data: {
          nom: input.name,
          description: input.description,
          prix: input.price,
          typePrix: input.priceType,
          modeDeplacement: input.travelMode,
          dureeMinutes: input.durationMinutes,
          estObligatoire: input.isRequired,
        },
        select: SERVICE_SELECT,
      });
      return { status: 'updated', service: this.mapService(service) };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        return { status: 'service_not_found' };
      }
      throw error;
    }
  }

  async disableService(
    utilisateurId: string,
    serviceId: string,
  ): Promise<DisableServiceResult> {
    const profileId = await this.getProfileIdByUserId(utilisateurId);
    if (!profileId) {
      return { status: 'profile_not_found' };
    }

    try {
      const service = await this.prisma.service.update({
        where: {
          id: serviceId,
          profilProfessionnelId: profileId,
        },
        data: { estDisponible: false },
        select: SERVICE_SELECT,
      });
      return { status: 'disabled', service: this.mapService(service) };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        return { status: 'service_not_found' };
      }
      throw error;
    }
  }

  // ─── Portfolio Operations ──────────────────────────────────────────────────

  async listPortfolio(
    profileId: string,
  ): Promise<ProfessionalPortfolioItemView[]> {
    return this.prisma.elementPortfolio.findMany({
      where: { profilProfessionnelId: profileId },
      orderBy: { creeLe: 'desc' },
      select: PORTFOLIO_SELECT,
    });
  }

  async createPortfolioItem(
    input: CreatePortfolioItemInput,
  ): Promise<CreatePortfolioItemResult> {
    const profileId = await this.getProfileIdByUserId(input.utilisateurId);
    if (!profileId) {
      return { status: 'profile_not_found' };
    }

    const item = await this.prisma.elementPortfolio.create({
      data: {
        profilProfessionnelId: profileId,
        titre: input.title,
        description: input.description ?? null,
        urlImage: input.imageUrl,
      },
      select: PORTFOLIO_SELECT,
    });
    return { status: 'created', item };
  }

  async deletePortfolioItem(
    utilisateurId: string,
    itemId: string,
  ): Promise<DeletePortfolioItemResult> {
    const profileId = await this.getProfileIdByUserId(utilisateurId);
    if (!profileId) {
      return { status: 'profile_not_found' };
    }

    const deleted = await this.prisma.elementPortfolio.deleteMany({
      where: { id: itemId, profilProfessionnelId: profileId },
    });
    if (deleted.count === 0) {
      return { status: 'item_not_found' };
    }
    return { status: 'deleted' };
  }

  // ─── Availability Operations ───────────────────────────────────────────────

  async listAvailabilities(
    profileId: string,
  ): Promise<ProfessionalAvailabilityView[]> {
    return this.prisma.disponibilite.findMany({
      where: { profilProfessionnelId: profileId, estActive: true },
      orderBy: [{ jourSemaine: 'asc' }, { heureDebut: 'asc' }],
      select: AVAILABILITY_SELECT,
    });
  }

  async createAvailability(
    input: CreateAvailabilityInput,
  ): Promise<CreateAvailabilityResult> {
    const profileId = await this.getProfileIdByUserId(input.utilisateurId);
    if (!profileId) {
      return { status: 'profile_not_found' };
    }

    const availability = await this.prisma.disponibilite.create({
      data: {
        profilProfessionnelId: profileId,
        jourSemaine: input.dayOfWeek,
        heureDebut: input.startTime,
        heureFin: input.endTime,
      },
      select: AVAILABILITY_SELECT,
    });
    return { status: 'created', availability };
  }

  async updateAvailability(
    input: UpdateAvailabilityInput,
  ): Promise<UpdateAvailabilityResult> {
    const profileId = await this.getProfileIdByUserId(input.utilisateurId);
    if (!profileId) {
      return { status: 'profile_not_found' };
    }

    const updated = await this.prisma.disponibilite.updateMany({
      where: {
        id: input.availabilityId,
        profilProfessionnelId: profileId,
      },
      data: {
        jourSemaine: input.dayOfWeek,
        heureDebut: input.startTime,
        heureFin: input.endTime,
        estActive: true,
      },
    });

    if (updated.count === 0) {
      return { status: 'availability_not_found' };
    }

    const availability = await this.prisma.disponibilite.findUniqueOrThrow({
      where: { id: input.availabilityId },
      select: AVAILABILITY_SELECT,
    });

    return { status: 'updated', availability };
  }

  async disableAvailability(
    utilisateurId: string,
    availabilityId: string,
  ): Promise<DisableAvailabilityResult> {
    const profileId = await this.getProfileIdByUserId(utilisateurId);
    if (!profileId) {
      return { status: 'profile_not_found' };
    }

    try {
      const availability = await this.prisma.disponibilite.update({
        where: {
          id: availabilityId,
          profilProfessionnelId: profileId,
        },
        data: { estActive: false },
        select: AVAILABILITY_SELECT,
      });
      return { status: 'disabled', availability };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        return { status: 'availability_not_found' };
      }
      throw error;
    }
  }

  // ─── Review Operations ─────────────────────────────────────────────────────

  async listReviews(profileId: string): Promise<ProfessionalReviewView[]> {
    const rows = await this.prisma.reservation.findMany({
      where: {
        professionnelId: profileId,
        clientRating: {
          not: null,
        },
      },
      orderBy: [{ clientReviewedAt: 'desc' }, { creeLe: 'desc' }],
      select: {
        id: true,
        clientRating: true,
        clientReview: true,
        clientReviewedAt: true,
        dateHeure: true,
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

    return rows.map((row) => ({
      id: row.id,
      note: row.clientRating ?? 0,
      commentaire: row.clientReview,
      reviewedAt: row.clientReviewedAt ?? row.creeLe,
      dateHeure: row.dateHeure,
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

  // ─── Mapper ────────────────────────────────────────────────────────────────

  private mapProfile(profile: RawProfessionalProfile): ProfessionalProfileView {
    return {
      id: profile.id,
      utilisateurId: profile.utilisateurId,
      biographie: profile.biographie,
      nomEntreprise: profile.nomEntreprise,
      urlPieceIdentiteRecto: null,
      urlPieceIdentiteVerso: null,
      statutKyc: profile.statutKyc,
      raisonRejetKyc: profile.raisonRejetKyc,
      ville: profile.ville,
      latitude: profile.latitude ?? null,
      longitude: profile.longitude ?? null,
      noteGlobale: profile.noteGlobale.toNumber(),
      nombreAvis: profile.nombreAvis,
      creeLe: profile.creeLe,
      utilisateur: profile.utilisateur
        ? {
            id: profile.utilisateur.id,
            nom: profile.utilisateur.nom,
            numeroTelephone: profile.utilisateur.numeroTelephone,
            urlAvatar: profile.utilisateur.urlAvatar,
            estActif: profile.utilisateur.estActif,
          }
        : {
            id: '',
            nom: '',
            numeroTelephone: '',
            urlAvatar: null,
            estActif: false,
          },
    };
  }

  private async getProfileCoordinates(profileId: string): Promise<{
    latitude: number | null;
    longitude: number | null;
  }> {
    const rows = await this.prisma.$queryRaw<
      Array<{ latitude: number | null; longitude: number | null }>
    >(Prisma.sql`
      SELECT
        ST_Y(localisation::geometry) AS latitude,
        ST_X(localisation::geometry) AS longitude
      FROM professional_profiles
      WHERE id = ${profileId}::uuid
      LIMIT 1
    `);

    const first = rows[0];
    return {
      latitude: first?.latitude == null ? null : Number(first.latitude),
      longitude: first?.longitude == null ? null : Number(first.longitude),
    };
  }

  private mapAdminKycProfile(
    profile: RawProfessionalProfile,
  ): AdminKycProfileView {
    return {
      ...this.mapProfile(profile),
      urlPieceIdentiteRecto: profile.urlPieceIdentiteRecto ?? null,
      urlPieceIdentiteVerso: profile.urlPieceIdentiteVerso ?? null,
    };
  }
}
