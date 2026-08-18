export const SEARCH_REPOSITORY_PORT = Symbol('SEARCH_REPOSITORY_PORT');

export type SearchProfessionalsInput = {
  city?: string;
  categoryId?: string;
  subCategoryId?: string;
  query?: string;
  role?: 'PRESTATAIRE' | 'MEDECIN';
  travelMode?:
    | 'PRESTATAIRE_SE_DEPLACE'
    | 'CLIENT_SE_DEPLACE'
    | 'TRANSPORT_COLIS';
  latitude?: number;
  longitude?: number;
  radiusKm?: number;
  page: number;
  limit: number;
};

export type SearchProfessionalServiceView = {
  id: string;
  name: string;
  price: number;
  priceType: string;
  travelMode: string;
  urlImage?: string | null;
  categoryId: string;
  categoryName: string;
  subCategoryId?: string | null;
  subCategoryName?: string | null;
};

export type SearchProfessionalPortfolioImageView = {
  id: string;
  title: string;
  url: string;
};

export type SearchProfessionalView = {
  id: string;
  userId: string;
  name: string;
  avatarUrl: string | null;
  companyName: string | null;
  bio: string | null;
  city: string | null;
  typeVehicule?: 'MOTO_SCOOTER' | 'VOITURE' | 'CAMIONNETTE';
  latitude: number | null;
  longitude: number | null;
  rating: number;
  totalReviews: number;
  distanceKm: number | null;
  services: SearchProfessionalServiceView[];
  specialties: SearchProfessionalServiceView[];
  portfolioImages: SearchProfessionalPortfolioImageView[];
};

export type SearchProfessionalsResult = {
  items: SearchProfessionalView[];
  total: number;
  page: number;
  limit: number;
};

export interface SearchRepositoryPort {
  searchProfessionals(
    input: SearchProfessionalsInput,
  ): Promise<SearchProfessionalsResult>;
  listAvailableCities(): Promise<string[]>;
}
