export type AppointmentStatus =
  | 'EN_ATTENTE'
  | 'CONFIRMEE'
  | 'PAYEE_SEQUESTRE'
  | 'EN_COURS'
  | 'TERMINEE'
  | 'ANNULEE'
  | 'NO_SHOW'
  | 'LITIGE';

export interface BackendReservation {
  id: string;
  clientId: string;
  professionnelId: string;
  serviceId: string;
  dateHeure: string;
  adresseClient: string;
  dureeMinutes: number;
  statut: AppointmentStatus;
  notes: string | null;
  prixConvenu: number | null;
  statutAjustementPrix: 'AUCUN' | 'EN_ATTENTE_CLIENT' | 'ACCEPTE' | 'REFUSE';
  prixAjustementPropose: number | null;
  raisonAjustementPrix: string | null;
  demandeAjustementPrixLe: string | null;
  clientRating: number | null;
  clientReview: string | null;
  clientReviewedAt: string | null;
  raisonAnnulation: string | null;
  creeLe: string;
  misAJourLe: string;
  client?: {
    id: string;
    nom: string;
    numeroTelephone: string;
    email: string | null;
    adresse: string | null;
    urlAvatar: string | null;
  };
  service?: {
    id: string;
    profilProfessionnelId: string;
    categorieId: string;
    nom: string;
    description: string;
    prix: number;
    typePrix: string;
    dureeMinutes: number;
    estObligatoire: boolean;
    estDisponible: boolean;
    categorie: {
      id: string;
      nom: string;
      urlIcone: string | null;
      tauxCommission: number;
    };
  };
  professionnel?: {
    id: string;
    utilisateurId: string;
    nomEntreprise: string | null;
    ville: string | null;
    noteGlobale: number;
    nombreAvis: number;
    utilisateur: {
      id: string;
      nom: string;
      numeroTelephone: string;
      urlAvatar: string | null;
    };
  };
}

export interface AppointmentView {
  id: string;
  professionalId: string;
  serviceId: string;
  status: AppointmentStatus;
  scheduledAt: string;
  durationMinutes: number;
  eyebrow: string;
  dateLabel: string;
  shortDateLabel: string;
  fullDateLabel: string;
  timeLabel: string;
  locationLabel: string;
  doctorName: string;
  specialty: string;
  avatarUrl: string;
  serviceName: string;
  notes: string | null;
  agreedPrice: number | null;
  priceAdjustmentStatus: 'AUCUN' | 'EN_ATTENTE_CLIENT' | 'ACCEPTE' | 'REFUSE';
  proposedAdjustedPrice: number | null;
  priceAdjustmentReason: string | null;
  priceAdjustmentRequestedAt: string | null;
  clientRating: number | null;
  clientReview: string | null;
  clientReviewedAt: string | null;
  confirmationLabel: string;
  addressLabel: string;
}

export interface AppointmentPresenceView {
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

export interface AppointmentTrackingView {
  reservationId: string;
  clientUserId: string;
  professionalId: string;
  professionalUserId: string;
  trackingStatus: 'EN_ROUTE' | 'TERMINEE' | 'ANNULEE' | 'INACTIF';
  startedAt: string | null;
  endedAt: string | null;
  lastLatitude: number | null;
  lastLongitude: number | null;
  lastAccuracyMeters: number | null;
  lastHeadingDegrees: number | null;
  lastSpeedKmh: number | null;
  lastLocationLabel: string | null;
  lastPositionAt: string | null;
  updatedAt: string | null;
  presence: AppointmentPresenceView;
}

export type PaymentMethod = 'WAVE' | 'ORANGE_MONEY' | 'CARD';

export interface PaymentInitiationView {
  payment: {
    id: string;
    bookingId: string;
    clientId: string;
    professionalId: string;
    method: PaymentMethod;
    amount: number;
    status: string;
    transactionReference: string | null;
    gatewayReference: string | null;
    escrowStatus: string;
    commissionRate: number;
    commissionAmount: number;
    professionalAmount: number;
    createdAt: string;
    updatedAt: string;
  };
  paymentUrl: string;
  gatewayReference: string;
}

export interface AppointmentStat {
  label: string;
  value: number;
  caption: string;
}
