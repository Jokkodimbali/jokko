export interface Category {
  id: string;
  nom: string;
  urlIcone: string | null;
  ordreTri: number;
  tauxCommission: number;
  estActive: boolean;
}

export interface Professional {
  id: string;
  nom: string;
  speciality: string;
  location: string;
  status: string;
  rating: number;
  totalReviews: number;
  isOnline: boolean;
  onlineLabel: string;
  avatar?: string;
  photos: string[];
}

export interface ProviderProfileDetail {
  profile: BackendProfessionalProfile;
  services: BackendProfessionalDetailService[];
  portfolio: BackendProfessionalPortfolioItem[];
  availabilities: BackendProfessionalAvailability[];
  reviews: BackendProfessionalReview[];
  presence: BackendProfessionalPresence;
}

export interface BackendProfessionalProfile {
  id: string;
  utilisateurId: string;
  biographie: string | null;
  nomEntreprise: string | null;
  statutKyc: 'EN_ATTENTE' | 'VERIFIE' | 'REJETE' | 'NON_SOUMIS';
  raisonRejetKyc: string | null;
  ville: string | null;
  latitude: number | null;
  longitude: number | null;
  noteGlobale: number;
  nombreAvis: number;
  creeLe: string;
  utilisateur: {
    id: string;
    nom: string;
    numeroTelephone: string;
    urlAvatar: string | null;
    estActif: boolean;
  };
}

export interface BackendProfessional {
  id: string;
  userId: string;
  name: string;
  avatarUrl: string | null;
  companyName: string | null;
  bio: string | null;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
  rating: number;
  totalReviews: number;
  distanceKm: number | null;
  services: BackendProfessionalService[];
}

export interface BackendProfessionalService {
  id: string;
  name: string;
  price: number;
  priceType: string;
  categoryId: string;
  categoryName: string;
}

export interface BackendProfessionalDetailService {
  id: string;
  profilProfessionnelId: string;
  categorieId: string;
  nom: string;
  description: string;
  prix: number;
  typePrix: 'FIXE' | 'NEGOCIABLE';
  dureeMinutes?: number;
  estObligatoire?: boolean;
  estDisponible: boolean;
  creeLe: string;
}

export interface BackendProfessionalPortfolioItem {
  id: string;
  titre: string;
  description: string | null;
  urlImage: string;
  creeLe: string;
}

export interface BackendProfessionalAvailability {
  id: string;
  jourSemaine: number;
  heureDebut: string;
  heureFin: string;
  estActive: boolean;
}

export interface BackendProfessionalReview {
  id: string;
  note: number;
  commentaire: string | null;
  reviewedAt: string;
  dateHeure: string;
  creeLe: string;
  service: {
    id: string;
    nom: string;
  };
  client: {
    id: string;
    nom: string;
    urlAvatar: string | null;
  };
}

export interface BackendProfessionalPresence {
  professionalId: string;
  isOnline: boolean;
  status: 'HORS_LIGNE' | 'EN_LIGNE' | 'EN_ROUTE' | 'EN_PRESTATION';
  lastLatitude: number | null;
  lastLongitude: number | null;
  lastAccuracyMeters: number | null;
  lastHeadingDegrees: number | null;
  lastSpeedKmh: number | null;
  lastLocationLabel: string | null;
  lastPositionAt: string | null;
  lastSeenAt: string | null;
  updatedAt: string;
}

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

export interface ServiceSection {
  id: string;
  title: string;
  countLabel: string;
  providers: Professional[];
  pagination?: PaginationMeta;
}
