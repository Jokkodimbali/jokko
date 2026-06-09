export const SEARCH_REPOSITORY_PORT = Symbol('SEARCH_REPOSITORY_PORT');

export type SearchProfessionalsInput = {
  city?: string;
  categoryId?: string;
  query?: string;
  role?: 'PRESTATAIRE' | 'MEDECIN';
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
  categoryId: string;
  categoryName: string;
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
}
