export type AppointmentStatus =
  | 'CONFIRMEE'
  | 'PAYEE_SEQUESTRE'
  | 'EN_COURS'
  | 'TERMINEE'
  | 'ANNULEE'
  | 'NO_SHOW'
  | 'LITIGE';

export type AppointmentTravelMode =
  | 'PRESTATAIRE_SE_DEPLACE'
  | 'CLIENT_SE_DEPLACE'
  | 'TRANSPORT_COLIS';

export type AppointmentVehicleType =
  | 'MOTO_SCOOTER'
  | 'VOITURE'
  | 'CAMIONNETTE';

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
  actesPrescriptionMedicale?: string[] | null;
  vaccinsPrescriptionMedicale?: string[] | null;
  traitementsPrescriptionMedicale?: string[] | null;
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
    modeDeplacement: AppointmentTravelMode;
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
    latitude?: number | null;
    longitude?: number | null;
    noteGlobale: number;
    nombreAvis: number;
    typeVehicule?: AppointmentVehicleType | null;
    utilisateur: {
      id: string;
      nom: string;
      numeroTelephone: string;
      urlAvatar: string | null;
    };
    specialites?: Array<{
      id: string;
      categorieId: string;
      sousCategorieId: string | null;
      categorie: {
        nom: string;
      };
      sousCategorie: {
        nom: string;
      } | null;
    }>;
  };
}

export interface AppointmentView {
  id: string;
  clientId: string;
  professionalId: string;
  professionalUserId: string | null;
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
  professionalPhone: string | null;
  professionalAddressLabel: string | null;
  professionalLatitude: number | null;
  professionalLongitude: number | null;
  professionalRating: number | null;
  professionalReviews: number;
  clientName: string;
  clientPhone: string | null;
  clientAvatarUrl: string;
  serviceName: string;
  serviceDescription: string | null;
  serviceCategoryName: string | null;
  professionalSubCategoryName: string | null;
  servicePrice: number | null;
  travelMode: AppointmentTravelMode | null;
  vehicleType: AppointmentVehicleType | null;
  notes: string | null;
  medicalPrescription: MedicalPrescriptionPayload | null;
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

export interface MedicalPrescriptionPayload {
  acts: string[];
  vaccines: string[];
  treatments: string[];
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
  route?: {
    distanceRemainingMeters: number;
    durationRemainingSeconds: number;
    estimatedArrivalAt: string;
    encodedPolyline: string;
    coordinates: Array<{ latitude: number; longitude: number }>;
    navigationSteps?: Array<{
      id: string;
      instruction: string;
      maneuver: string | null;
      distanceMeters: number | null;
      durationSeconds: number | null;
      start: { latitude: number; longitude: number } | null;
      end: { latitude: number; longitude: number } | null;
    }>;
  } | null;
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

export interface DisputeEvidenceView {
  id: string;
  uploaderUserId: string;
  originalFileName: string;
  mimeType: string;
  sizeBytes: number;
  fileUrl: string;
  createdAt: string | Date;
  uploader: {
    id: string;
    nom: string;
    role: string;
  };
}

export interface ReservationDisputeView {
  id: string;
  reservationId: string;
  paiementId: string | null;
  reporterUserId: string;
  resolvedByAdminUserId: string | null;
  statut: 'OUVERT' | 'EN_REVUE' | 'RESOLU' | 'REJETE' | string;
  priorite: 'BASSE' | 'MOYENNE' | 'HAUTE' | string;
  raison: string;
  notesInternes: string | null;
  decisionResolution: string | null;
  pourcentageRemboursementClient: number | null;
  montantRembourseClient: number | null;
  montantPrestataire: number | null;
  ouvertLe: string | Date;
  prisEnChargeLe: string | Date | null;
  resoluLe: string | Date | null;
  rejeteLe: string | Date | null;
  creeLe: string | Date;
  misAJourLe: string | Date;
  slaRemainingHours?: number;
  reservation: {
    id: string;
    statut: string;
    dateHeure: string | Date;
    adresseClient: string;
    dureeMinutes: number;
    prixConvenu: number | null;
    clientId: string;
    professionnelId: string;
    serviceId: string;
    service: {
      id: string;
      nom: string;
      prix: number;
    };
    messages: Array<{
      id: string;
      expediteurId: string;
      contenu: string | null;
      urlMedia: string | null;
      creeLe: string | Date;
      expediteur: {
        id: string;
        nom: string;
        role: string;
      };
    }>;
    mediationMessages: Array<{
      id: string;
      destinataire: 'CLIENT' | 'PRESTATAIRE' | 'TOUS';
      contenu: string;
      creeLe: string | Date;
      expediteurAdmin: {
        id: string;
        nom: string;
      };
    }>;
  };
  payment: {
    id: string;
    statut: string;
    escrowStatus: string;
    montant: number;
    montantNet: number;
  } | null;
  reporter: {
    id: string;
    nom: string;
    role: string;
  };
  client: {
    id: string;
    nom: string;
  };
  professional: {
    profileId: string;
    userId: string;
    nom: string;
  };
  evidence: DisputeEvidenceView[];
}
