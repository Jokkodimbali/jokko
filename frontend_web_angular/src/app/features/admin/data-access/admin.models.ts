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

export interface AdminProviderProfile {
  id: string;
  userId: string;
  name: string;
  companyName: string | null;
  phone: string;
  avatarUrl: string | null;
  city: string | null;
  bio: string | null;
  kycStatus: string;
  active: boolean;
  rating: number;
  reviewsCount: number;
  walletBalance: number;
  createdAt: string | Date;
  servicesCount: number;
  activeServicesCount: number;
  reservationsCount: number;
  completedReservationsCount: number;
  activeReservationsCount: number;
  disputesCount: number;
  revenueGross: number;
  revenueNet: number;
  mainCategories: string[];
  lastBookingAt: string | Date | null;
  services?: Array<{
    id: string;
    name: string;
    category: string;
    active: boolean;
  }>;
  recentReservations?: Array<{
    id: string;
    status: string;
    scheduledAt: string | Date;
    address: string;
    price: number | null;
    clientName: string;
    serviceName: string;
    hasDispute: boolean;
  }>;
  medicalCredentials?: Array<{
    id: string;
    title: string;
    institution: string;
    graduationYear: string | null;
    status: string;
    verifiedAt: string | Date | null;
  }>;
  portfolio?: Array<{
    id: string;
    title: string;
    imageUrl: string;
    createdAt: string | Date;
  }>;
}

export interface AdminProviderListQuery {
  search?: string;
  kycStatus?: string;
  active?: boolean;
  page?: number;
  limit?: number;
}

export interface AdminPaginatedResult<T> {
  items: T[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNext: boolean;
    hasPrevious: boolean;
  };
  stats?: AdminProviderStats;
}

export interface AdminProviderStats {
  totalProviders: number;
  verifiedCount: number;
  activeCount: number;
  reservationsCount: number;
  revenueGross: number;
  revenueNet: number;
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

export type AdminRevenuePeriod = '7d' | '30d' | '90d' | '12m';

export interface AdminRevenueSeriesPoint {
  label: string;
  startDate: string | Date;
  endDate: string | Date;
  gross: number;
  net: number;
  commission: number;
  refunded: number;
  transactions: number;
}

export interface AdminRevenueMethod {
  key: string;
  label: string;
  gross: number;
  transactions: number;
  share: number;
}

export interface AdminRevenueProvider {
  id: string;
  name: string;
  companyName: string | null;
  city: string | null;
  gross: number;
  net: number;
  transactions: number;
}

export interface AdminRevenuePayment {
  id: string;
  reference: string | null;
  method: string;
  status: string;
  amount: number;
  net: number;
  commission: number;
  createdAt: string | Date;
  clientName: string;
  professionalName: string;
  serviceName: string;
}

export interface AdminRevenueReport {
  period: AdminRevenuePeriod;
  generatedAt: string | Date;
  totals: {
    gross: number;
    net: number;
    commission: number;
    refunded: number;
    totalPayments: number;
    successfulPayments: number;
    refundedPayments: number;
    pendingPayments: number;
    failedPayments: number;
    averageTicket: number;
    successRate: number;
  };
  series: AdminRevenueSeriesPoint[];
  methods: AdminRevenueMethod[];
  topProviders: AdminRevenueProvider[];
  recentPayments: AdminRevenuePayment[];
}

export interface AdminRegionCategory {
  label: string;
  value: number;
}

export interface AdminRegionRow {
  name: string;
  clients: number;
  providers: number;
  activeProviders: number;
  verifiedProviders: number;
  services: number;
  availableServices: number;
  reservations: number;
  completedReservations: number;
  activeReservations: number;
  disputes: number;
  grossRevenue: number;
  netRevenue: number;
  averageRating: number;
  verificationRate: number;
  completionRate: number;
  topCategories: AdminRegionCategory[];
}

export interface AdminRegionsReport {
  generatedAt: string | Date;
  totals: {
    clients: number;
    regions: number;
    providers: number;
    activeProviders: number;
    verifiedProviders: number;
    services: number;
    availableServices: number;
    reservations: number;
    completedReservations: number;
    activeReservations: number;
    disputes: number;
    grossRevenue: number;
    netRevenue: number;
  };
  regions: AdminRegionRow[];
  topRegions: AdminRegionRow[];
  coverage: {
    strongestRegion: string | null;
    regionsWithRevenue: number;
    regionsWithDisputes: number;
    verifiedCoverageRate: number;
  };
}

export type AdminArchiveTab = 'closedDisputes' | 'invoices' | 'transactions';

export interface AdminArchiveItem {
  id: string;
  reference: string;
  date: string | Date;
  type: string;
  from: string;
  to: string;
  amount: number;
  commission: number;
  status: string;
  method: string | null;
  decision?: string | null;
  reason?: string | null;
  netAmount?: number;
  description?: string;
  balanceAfter?: number;
  serviceName?: string | null;
}

export interface AdminArchivesReport {
  generatedAt: string | Date;
  totals: {
    closedDisputes: number;
    invoices: number;
    transactions: number;
    invoiceGrossAmount: number;
    invoiceCommissionAmount: number;
    transactionAmount: number;
  };
  closedDisputes: AdminArchiveItem[];
  invoices: AdminArchiveItem[];
  transactions: AdminArchiveItem[];
  pagination: {
    tab: AdminArchiveTab;
    total: number;
    limit: number;
    offset: number;
  };
}

export interface AdminArchivesQuery {
  tab?: AdminArchiveTab;
  limit?: number;
  offset?: number;
  search?: string;
}

export interface AdminServiceStructureOption {
  id: string;
  label: string;
  description: string | null;
  offerCount: number;
  minPrice: number;
  maxPrice: number;
  minDurationMinutes: number;
  maxDurationMinutes: number;
}

export interface AdminServiceStructureBranch {
  id: string;
  label: string;
  optionCount: number;
  options: AdminServiceStructureOption[];
}

export interface AdminServiceSubCategory {
  id: string;
  name: string;
  description: string | null;
  sortOrder: number;
  isActive: boolean;
}

export interface AdminServiceStructureCategory {
  id: string;
  name: string;
  iconUrl: string | null;
  sortOrder: number;
  commissionRate: number;
  isActive: boolean;
  declaredServices: number;
  availableServices: number;
  requiredServices: number;
  subCategories: AdminServiceSubCategory[];
  branches: AdminServiceStructureBranch[];
}

export interface AdminServiceStructureReport {
  generatedAt: string | Date;
  totals: {
    categories: number;
    activeCategories: number;
    subCategories: number;
    declaredServices: number;
    availableServices: number;
    requiredServices: number;
  };
  categories: AdminServiceStructureCategory[];
  availableSubCategories: AdminServiceSubCategory[];
}

export interface AdminCategoryPayload {
  name: string;
  iconUrl?: string | null;
  sortOrder?: number;
  commissionRate?: number;
}

export interface AdminSubCategoryPayload {
  name: string;
  description?: string | null;
  sortOrder?: number;
}

export interface AdminBulkImportResult<T> {
  created: T[];
  skippedExisting: string[];
  totalRequested: number;
}

export interface AdminUserProfile {
  id: string;
  numeroTelephone: string;
  nom: string;
  email: string | null;
  adresse: string | null;
  role: string;
  urlAvatar: string | null;
  estActif: boolean;
  creeLe: string | Date;
  profilProfessionnel: {
    id: string;
    nomEntreprise: string | null;
    categories: string[];
  } | null;
}

export interface AdminUserRow extends AdminUserProfile {
  nombreReservationsClient: number;
  nombreReservationsPrestataire: number;
}

export interface AdminUserQuery {
  role?: string;
  isActive?: boolean;
  search?: string;
  limit?: number;
  offset?: number;
}

export interface AdminUserHistoryReservation {
  id: string;
  statut: string;
  dateHeure: string | Date;
  notes: string | null;
  creeLe: string | Date;
  service: {
    id: string;
    nom: string;
    prix: number;
    typePrix: string;
  };
}

export interface AdminUserHistory {
  user: AdminUserProfile;
  reservationsAsClient: AdminUserHistoryReservation[];
  reservationsAsProfessional: AdminUserHistoryReservation[];
  paymentsAsClient: Array<{
    id: string;
    bookingId: string;
    amount: number;
    status: string;
    createdAt: string | Date;
  }>;
  withdrawalsAsProfessional: Array<{
    id: string;
    amount: number;
    status: string;
    requestedAt: string | Date;
  }>;
  notificationsCount: number;
}

export interface AdminReservationDetail {
  id: string;
  clientId: string;
  professionnelId: string;
  serviceId: string;
  dateHeure: string | Date;
  adresseClient: string;
  dureeMinutes: number;
  statut: string;
  notes: string | null;
  prixConvenu: number | null;
  clientRating: number | null;
  clientReview: string | null;
  clientReviewedAt: string | Date | null;
  raisonAnnulation: string | null;
  creeLe: string | Date;
  misAJourLe: string | Date;
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
    nom: string;
    description: string;
    prix: number;
    typePrix: string;
    dureeMinutes: number;
    categorie?: { nom: string };
  };
  professionnel?: {
    id: string;
    nomEntreprise: string | null;
    ville: string | null;
    utilisateur: {
      id: string;
      nom: string;
      numeroTelephone: string;
      urlAvatar: string | null;
    };
  };
}

export interface AdminReservationStatistics {
  total: number;
  byStatus: Record<string, number>;
  cancellationRate: number;
  completionRate: number;
}

export interface AdminDateRangeQuery {
  startDate?: string;
  endDate?: string;
  status?: string;
  serviceId?: string;
  clientId?: string;
  professionalId?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

export interface AdminOffsetPagination {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

export interface AdminReservationsPage {
  items: AdminReservationDetail[];
  pagination: AdminOffsetPagination;
}

export interface AdminPayment {
  id: string;
  bookingId: string;
  clientId?: string;
  professionalId?: string;
  status: string;
  escrowStatus?: string;
  amount: number;
  commissionAmount: number;
  netAmount: number;
  method: string;
  createdAt?: string | Date;
}

export interface AdminPaymentHistory {
  payments: AdminPayment[];
  total: number;
}

export interface AdminPaymentsReport {
  clientPayments: AdminPaymentHistory;
  professionalPayments: AdminPaymentHistory;
}

export interface AdminPaymentsQuery {
  status?: string;
  method?: string;
  bookingId?: string;
  clientId?: string;
  professionalId?: string;
  limit?: number;
  offset?: number;
}

export interface AdminPaymentStatistics {
  pendingEscrowReleases: number;
  totalEscrowAmount: number;
  totalPayments: number;
  totalRevenue: number;
  totalGrossAmount?: number;
}

export interface AdminPendingEscrowPayment {
  id: string;
  bookingId: string;
  clientId: string;
  professionalId: string;
  amount: number;
  netAmount: number;
  commissionAmount: number;
  createdAt: string | Date;
}

export interface AdminEscrowProcessResult {
  processedCount: number;
  processedPayments: Array<{ id: string; status: string }>;
  failedCount: number;
  failedPayments: Array<{ id: string; status: string; error: string }>;
}

export interface AdminPaymentRefundResult {
  payment: AdminPayment;
  isRefunded: boolean;
}

export interface AdminBroadcastPayload {
  target: 'CLIENT' | 'PRESTATAIRE' | 'ALL';
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

export interface AdminBroadcastResult {
  recipientCount: number;
  target: AdminBroadcastPayload['target'];
}
