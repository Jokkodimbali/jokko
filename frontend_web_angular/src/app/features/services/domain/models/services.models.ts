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
  avatar?: string;
  photos: string[];
}

export interface BackendProfessional {
  id: string;
  userId: string;
  name: string;
  avatarUrl: string | null;
  companyName: string | null;
  bio: string | null;
  city: string | null;
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
