/**
 * CQRS Commands for the Professionals module.
 * Commands represent write operations that change state.
 */

export type CreateProfessionalProfileCommand = {
  bio?: string | null;
  companyName?: string | null;
  bannerUrl?: string | null;
  city?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  vehicleType?: 'MOTO_SCOOTER' | 'VOITURE' | 'CAMIONNETTE';
};

// Update uses the same shape as Create; we alias for semantic clarity
// but reuse the type to respect DRY.
export type UpdateProfessionalProfileCommand = CreateProfessionalProfileCommand;

export type SubmitKycCommand = {
  idCardUrl: string;
  idCardUrlVerso?: string;
};

export type RejectKycCommand = {
  reason: string;
};

export type CreateProfessionalServiceCommand = {
  categoryId: string;
  name: string;
  description: string;
  imageUrl?: string | null;
  price: number;
  priceType: 'FIXE' | 'NEGOCIABLE';
  travelMode?:
    | 'PRESTATAIRE_SE_DEPLACE'
    | 'CLIENT_SE_DEPLACE'
    | 'TRANSPORT_COLIS';
  durationMinutes?: number;
  pauseMinutes?: number;
  isRequired?: boolean;
  teleconsultationEnabled?: boolean;
};

export type UpdateProfessionalServiceCommand = {
  name?: string;
  description?: string;
  imageUrl?: string | null;
  price?: number;
  priceType?: 'FIXE' | 'NEGOCIABLE';
  travelMode?:
    | 'PRESTATAIRE_SE_DEPLACE'
    | 'CLIENT_SE_DEPLACE'
    | 'TRANSPORT_COLIS';
  durationMinutes?: number;
  pauseMinutes?: number;
  isRequired?: boolean;
  teleconsultationEnabled?: boolean;
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

export type UpdateAvailabilityCommand = CreateAvailabilityCommand;
