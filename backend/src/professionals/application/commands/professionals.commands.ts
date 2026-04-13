export type CreateProfessionalProfileCommand = {
  bio?: string | null;
  companyName?: string | null;
  city?: string | null;
};

export type UpdateProfessionalProfileCommand = {
  bio?: string | null;
  companyName?: string | null;
  city?: string | null;
};

export type SubmitKycCommand = {
  idCardUrl: string;
};

export type RejectKycCommand = {
  reason: string;
};

export type ListProfessionalsQuery = {
  city?: string;
  limit?: number;
};

export type CreateProfessionalServiceCommand = {
  categoryId: string;
  name: string;
  description: string;
  price: number;
  priceType: 'FIXE' | 'NEGOCIABLE';
};

export type UpdateProfessionalServiceCommand = {
  name?: string;
  description?: string;
  price?: number;
  priceType?: 'FIXE' | 'NEGOCIABLE';
};

export type CreatePortfolioItemCommand = {
  title: string;
  description?: string | null;
  imageUrl: string;
};

export type CreateAvailabilityCommand = {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
};
