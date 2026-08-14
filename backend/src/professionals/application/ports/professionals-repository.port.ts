export type KycStatus = 'EN_ATTENTE' | 'VERIFIE' | 'REJETE' | 'NON_SOUMIS';
export type PriceType = 'FIXE' | 'NEGOCIABLE';
export type ServiceTravelMode =
  | 'PRESTATAIRE_SE_DEPLACE'
  | 'CLIENT_SE_DEPLACE'
  | 'TRANSPORT_COLIS';
export type ProfessionalVehicleType =
  | 'MOTO_SCOOTER'
  | 'VOITURE'
  | 'CAMIONNETTE';

export const PROFESSIONALS_REPOSITORY_PORT = Symbol(
  'PROFESSIONALS_REPOSITORY_PORT',
);

// ─── Shared View Types (for read queries / projections) ─────────────────────

export type ProfessionalProfileView = {
  id: string;
  utilisateurId: string;
  biographie: string | null;
  nomEntreprise: string | null;
  urlBanniere: string | null;
  urlPieceIdentiteRecto: string | null;
  urlPieceIdentiteVerso: string | null;
  statutKyc: KycStatus;
  raisonRejetKyc: string | null;
  ville: string | null;
  typeVehicule: ProfessionalVehicleType;
  latitude: number | null;
  longitude: number | null;
  noteGlobale: number;
  nombreAvis: number;
  subCategoryNames: string[];
  creeLe: Date;
  utilisateur: {
    id: string;
    nom: string;
    numeroTelephone: string;
    adresse: string | null;
    urlAvatar: string | null;
    estActif: boolean;
  };
};

export type AdminKycProfileView = ProfessionalProfileView & {
  urlPieceIdentiteRecto: string | null;
  urlPieceIdentiteVerso: string | null;
};

export type ProfessionalServiceView = {
  id: string;
  profilProfessionnelId: string;
  categorieId: string;
  nom: string;
  description: string;
  urlImage: string | null;
  prix: number;
  typePrix: PriceType;
  modeDeplacement: ServiceTravelMode;
  dureeMinutes: number;
  pauseMinutes: number;
  estObligatoire: boolean;
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
  note: number;
  commentaire: string | null;
  reviewedAt: Date;
  dateHeure: Date;
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

// ─── Profile Repository Port ─────────────────────────────────────────────────

export type CreateProfessionalProfileInput = {
  utilisateurId: string;
  biographie?: string | null;
  nomEntreprise?: string | null;
  urlBanniere?: string | null;
  ville?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  typeVehicule?: ProfessionalVehicleType;
};

export type CreateProfessionalProfileResult =
  | { status: 'created'; profile: ProfessionalProfileView }
  | { status: 'already_exists' }
  | { status: 'user_not_found' };

export type UpdateProfessionalProfileInput = {
  utilisateurId: string;
  biographie?: string | null;
  nomEntreprise?: string | null;
  urlBanniere?: string | null;
  ville?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  typeVehicule?: ProfessionalVehicleType;
};

export type UpdateProfessionalProfileResult =
  | { status: 'updated'; profile: ProfessionalProfileView }
  | { status: 'profile_not_found' };

export type SubmitKycInput = {
  utilisateurId: string;
  idCardUrlRecto: string;
  idCardUrlVerso: string | null;
};

export type SubmitKycResult =
  | { status: 'updated'; profile: ProfessionalProfileView }
  | { status: 'profile_not_found' };

export type ApproveKycResult =
  | { status: 'approved'; profile: ProfessionalProfileView }
  | { status: 'profile_not_found' };

export type RejectKycResult =
  | { status: 'rejected'; profile: ProfessionalProfileView }
  | { status: 'profile_not_found' };

export interface ProfessionalProfileRepositoryPort {
  createProfile(
    input: CreateProfessionalProfileInput,
  ): Promise<CreateProfessionalProfileResult>;
  findByUserId(userId: string): Promise<ProfessionalProfileView | null>;
  updateProfile(
    input: UpdateProfessionalProfileInput,
  ): Promise<UpdateProfessionalProfileResult>;
  submitKyc(input: SubmitKycInput): Promise<SubmitKycResult>;
  approveKyc(profileId: string): Promise<ApproveKycResult>;
  rejectKyc(profileId: string, reason: string): Promise<RejectKycResult>;
  findVerifiedById(profileId: string): Promise<ProfessionalProfileView | null>;
  findPublicById(profileId: string): Promise<ProfessionalProfileView | null>;
  listKycForAdmin(query?: {
    status?: KycStatus;
    limit?: number;
    offset?: number;
    search?: string;
  }): Promise<AdminKycProfileView[]>;
  countKycForAdmin(query?: {
    status?: KycStatus;
    search?: string;
  }): Promise<number>;
  findKycByIdForAdmin(profileId: string): Promise<AdminKycProfileView | null>;
}

// ─── Service Repository Port ─────────────────────────────────────────────────

export type CreateServiceInput = {
  utilisateurId: string;
  categoryId: string;
  name: string;
  description: string;
  imageUrl?: string | null;
  price: number;
  priceType: PriceType;
  travelMode?: ServiceTravelMode;
  durationMinutes?: number;
  pauseMinutes?: number;
  isRequired?: boolean;
};

export type UpdateServiceInput = {
  utilisateurId: string;
  serviceId: string;
  name?: string;
  description?: string;
  imageUrl?: string | null;
  price?: number;
  priceType?: PriceType;
  travelMode?: ServiceTravelMode;
  durationMinutes?: number;
  pauseMinutes?: number;
  isRequired?: boolean;
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

export interface ProfessionalServiceRepositoryPort {
  getServiceById(serviceId: string): Promise<ProfessionalServiceView | null>;
  listServices(profileId: string): Promise<ProfessionalServiceView[]>;
  createService(input: CreateServiceInput): Promise<CreateServiceResult>;
  updateService(input: UpdateServiceInput): Promise<UpdateServiceResult>;
  disableService(
    utilisateurId: string,
    serviceId: string,
  ): Promise<DisableServiceResult>;
}

// ─── Portfolio Repository Port ───────────────────────────────────────────────

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

export interface ProfessionalPortfolioRepositoryPort {
  listPortfolio(profileId: string): Promise<ProfessionalPortfolioItemView[]>;
  createPortfolioItem(
    input: CreatePortfolioItemInput,
  ): Promise<CreatePortfolioItemResult>;
  deletePortfolioItem(
    utilisateurId: string,
    itemId: string,
  ): Promise<DeletePortfolioItemResult>;
}

// ─── Availability Repository Port ────────────────────────────────────────────

export type CreateAvailabilityInput = {
  utilisateurId: string;
  dayOfWeek: number;
  startTime: Date;
  endTime: Date;
};

export type UpdateAvailabilityInput = CreateAvailabilityInput & {
  availabilityId: string;
};

export type CreateAvailabilityResult =
  | { status: 'created'; availability: ProfessionalAvailabilityView }
  | { status: 'profile_not_found' };

export type DisableAvailabilityResult =
  | { status: 'disabled'; availability: ProfessionalAvailabilityView }
  | { status: 'profile_not_found' }
  | { status: 'availability_not_found' };

export type UpdateAvailabilityResult =
  | { status: 'updated'; availability: ProfessionalAvailabilityView }
  | { status: 'profile_not_found' }
  | { status: 'availability_not_found' };

export interface ProfessionalAvailabilityRepositoryPort {
  listAvailabilities(
    profileId: string,
  ): Promise<ProfessionalAvailabilityView[]>;
  createAvailability(
    input: CreateAvailabilityInput,
  ): Promise<CreateAvailabilityResult>;
  updateAvailability(
    input: UpdateAvailabilityInput,
  ): Promise<UpdateAvailabilityResult>;
  disableAvailability(
    utilisateurId: string,
    availabilityId: string,
  ): Promise<DisableAvailabilityResult>;
}

// ─── Review Repository Port ──────────────────────────────────────────────────

export interface ProfessionalReviewRepositoryPort {
  listReviews(profileId: string): Promise<ProfessionalReviewView[]>;
}

// ─── Composite Port ──────────────────────────────────────────────────────────

export interface ProfessionalsRepositoryPort
  extends
    ProfessionalProfileRepositoryPort,
    ProfessionalServiceRepositoryPort,
    ProfessionalPortfolioRepositoryPort,
    ProfessionalAvailabilityRepositoryPort,
    ProfessionalReviewRepositoryPort {}
