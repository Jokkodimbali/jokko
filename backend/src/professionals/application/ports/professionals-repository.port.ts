import type { StatutKyc, TypePrix } from '@prisma/client';

export const PROFESSIONALS_REPOSITORY_PORT = Symbol(
  'PROFESSIONALS_REPOSITORY_PORT',
);

export type ProfessionalProfileView = {
  id: string;
  utilisateurId: string;
  biographie: string | null;
  nomEntreprise: string | null;
  urlPieceIdentite: string | null;
  statutKyc: StatutKyc;
  raisonRejetKyc: string | null;
  ville: string | null;
  noteGlobale: number;
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

export type CreateProfessionalProfileInput = {
  utilisateurId: string;
  biographie?: string | null;
  nomEntreprise?: string | null;
  ville?: string | null;
};

export type CreateProfessionalProfileResult =
  | { status: 'created'; profile: ProfessionalProfileView }
  | { status: 'already_exists' }
  | { status: 'user_not_found' };

export type SubmitKycInput = {
  utilisateurId: string;
  idCardUrl: string;
};

export type SubmitKycResult =
  | { status: 'updated'; profile: ProfessionalProfileView }
  | { status: 'profile_not_found' };

export type UpdateProfessionalProfileInput = {
  utilisateurId: string;
  biographie?: string | null;
  nomEntreprise?: string | null;
  ville?: string | null;
};

export type UpdateProfessionalProfileResult =
  | { status: 'updated'; profile: ProfessionalProfileView }
  | { status: 'profile_not_found' };

export type ProfessionalServiceView = {
  id: string;
  nom: string;
  description: string;
  prix: number;
  typePrix: TypePrix;
  estDisponible: boolean;
  creeLe: Date;
};

export type ProfessionalPortfolioItemView = {
  id: string;
  titre: string;
  description: string | null;
  urlImage: string;
  creeLe: Date;
};

export type ProfessionalAvailabilityView = {
  id: string;
  jourSemaine: number;
  heureDebut: Date;
  heureFin: Date;
  estActive: boolean;
};

export type ProfessionalReviewView = {
  id: string;
  noteClient: number;
  avisClient: string | null;
  planifieeLe: Date;
  creeLe: Date;
  service: {
    id: string;
    nom: string;
  };
  client: {
    id: string;
    nom: string;
    urlAvatar: string | null;
  };
};

export type CreateServiceInput = {
  utilisateurId: string;
  categoryId: string;
  name: string;
  description: string;
  price: number;
  priceType: TypePrix;
};

export type UpdateServiceInput = {
  utilisateurId: string;
  serviceId: string;
  name?: string;
  description?: string;
  price?: number;
  priceType?: TypePrix;
};

export type CreateServiceResult =
  | { status: 'created'; service: ProfessionalServiceView }
  | { status: 'profile_not_found' }
  | { status: 'category_not_found' };

export type UpdateServiceResult =
  | { status: 'updated'; service: ProfessionalServiceView }
  | { status: 'profile_not_found' }
  | { status: 'service_not_found' };

export type DisableServiceResult =
  | { status: 'disabled'; service: ProfessionalServiceView }
  | { status: 'profile_not_found' }
  | { status: 'service_not_found' };

export type CreatePortfolioItemInput = {
  utilisateurId: string;
  title: string;
  description?: string | null;
  imageUrl: string;
};

export type CreatePortfolioItemResult =
  | { status: 'created'; item: ProfessionalPortfolioItemView }
  | { status: 'profile_not_found' };

export type DeletePortfolioItemResult =
  | { status: 'deleted' }
  | { status: 'profile_not_found' }
  | { status: 'item_not_found' };

export type CreateAvailabilityInput = {
  utilisateurId: string;
  dayOfWeek: number;
  startTime: Date;
  endTime: Date;
};

export type CreateAvailabilityResult =
  | { status: 'created'; availability: ProfessionalAvailabilityView }
  | { status: 'profile_not_found' };

export type DisableAvailabilityResult =
  | { status: 'disabled'; availability: ProfessionalAvailabilityView }
  | { status: 'profile_not_found' }
  | { status: 'availability_not_found' };

export interface ProfessionalsRepositoryPort {
  createProfile(
    input: CreateProfessionalProfileInput,
  ): Promise<CreateProfessionalProfileResult>;
  findByUserId(userId: string): Promise<ProfessionalProfileView | null>;
  updateProfile(
    input: UpdateProfessionalProfileInput,
  ): Promise<UpdateProfessionalProfileResult>;
  submitKyc(input: SubmitKycInput): Promise<SubmitKycResult>;
  approveKyc(profileId: string): Promise<ProfessionalProfileView | null>;
  rejectKyc(
    profileId: string,
    reason: string,
  ): Promise<ProfessionalProfileView | null>;
  findVerifiedById(profileId: string): Promise<ProfessionalProfileView | null>;
  listVerified(query: {
    city?: string;
    limit: number;
  }): Promise<ProfessionalProfileView[]>;
  listServices(profileId: string): Promise<ProfessionalServiceView[]>;
  listPortfolio(profileId: string): Promise<ProfessionalPortfolioItemView[]>;
  listAvailabilities(
    profileId: string,
  ): Promise<ProfessionalAvailabilityView[]>;
  listReviews(profileId: string): Promise<ProfessionalReviewView[]>;
  createService(input: CreateServiceInput): Promise<CreateServiceResult>;
  updateService(input: UpdateServiceInput): Promise<UpdateServiceResult>;
  disableService(
    utilisateurId: string,
    serviceId: string,
  ): Promise<DisableServiceResult>;
  createPortfolioItem(
    input: CreatePortfolioItemInput,
  ): Promise<CreatePortfolioItemResult>;
  deletePortfolioItem(
    utilisateurId: string,
    itemId: string,
  ): Promise<DeletePortfolioItemResult>;
  createAvailability(
    input: CreateAvailabilityInput,
  ): Promise<CreateAvailabilityResult>;
  disableAvailability(
    utilisateurId: string,
    availabilityId: string,
  ): Promise<DisableAvailabilityResult>;
}
