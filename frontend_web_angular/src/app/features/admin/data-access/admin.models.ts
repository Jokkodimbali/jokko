export interface AdminKpi {
  key: string;
  label: string;
  value: number;
  unit: string;
  trend: number;
  caption: string;
  tone: 'neutral' | 'success' | 'danger' | string;
}

export interface AdminPlatformMetric {
  key: 'web' | 'ios' | 'android' | string;
  label: string;
  value: number;
  share: number;
}

export interface AdminSeriesPoint {
  label: string;
  gross?: number;
  commission?: number;
  web?: number;
  ios?: number;
  android?: number;
}

export interface AdminCategoryMetric {
  label: string;
  value: number;
  share: number;
}

export interface AdminActivityItem {
  title: string;
  description: string;
  timestamp: string | Date;
}

export interface AdminMedicalValidation {
  id: string;
  name: string;
  practitionerName: string;
  specialty: string | null;
  city: string | null;
  phone: string;
  avatarUrl: string | null;
  submittedAt: string | Date;
  kycStatus: string;
  biography: string | null;
  council: string | null;
  diplomas: Array<{
    id: string;
    title: string;
    institution: string;
    graduationYear: string | null;
    referenceNumber: string | null;
    documentUrl: string | null;
    status: string;
    verificationNote: string | null;
    verifiedAt: string | Date | null;
  }>;
  declaredServices: Array<{
    label: string;
    category: string;
    description: string;
    durationMinutes: number;
  }>;
}

export interface AdminKycProfile {
  id: string;
  utilisateurId: string;
  biographie: string | null;
  nomEntreprise: string | null;
  urlPieceIdentiteRecto: string | null;
  urlPieceIdentiteVerso: string | null;
  statutKyc: 'EN_ATTENTE' | 'VERIFIE' | 'REJETE' | 'NON_SOUMIS' | string;
  raisonRejetKyc: string | null;
  ville: string | null;
  creeLe: string | Date;
  utilisateur: {
    id: string;
    nom: string;
    numeroTelephone: string;
    urlAvatar: string | null;
    estActif: boolean;
  };
}

export type AdminDisputeStatus = 'OUVERT' | 'EN_REVUE' | 'RESOLU' | 'REJETE' | string;
export type AdminDisputePriority = 'BASSE' | 'MOYENNE' | 'HAUTE' | string;

export interface AdminDisputeMessage {
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
}

export interface AdminDisputeMediationMessage {
  id: string;
  destinataire: 'CLIENT' | 'PRESTATAIRE' | 'TOUS';
  contenu: string;
  creeLe: string | Date;
  expediteurAdmin: {
    id: string;
    nom: string;
  };
}

export interface AdminDisputeCase {
  id: string;
  reservationId: string;
  paiementId: string | null;
  reporterUserId: string;
  resolvedByAdminUserId: string | null;
  statut: AdminDisputeStatus;
  priorite: AdminDisputePriority;
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
    messages: AdminDisputeMessage[];
    mediationMessages: AdminDisputeMediationMessage[];
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
}

export interface AdminDashboard {
  users: { active: number; total: number };
  kyc: { pending: number };
  reservations: {
    pending: number;
    confirmed: number;
    inEscrow: number;
    inProgress: number;
    active: number;
    completed?: number;
  };
  disputes: { open: number; inReview: number; resolved: number; rejected: number };
  revenue: {
    gross: number;
    commission: number;
    monthlyGross?: number;
    monthlyCommission?: number;
  };
  overview: {
    status: string;
    kpis: AdminKpi[];
    platforms: AdminPlatformMetric[];
    revenueSeries: AdminSeriesPoint[];
    trafficSeries: AdminSeriesPoint[];
    categoryDistribution: AdminCategoryMetric[];
    recentActivity: AdminActivityItem[];
  };
}
