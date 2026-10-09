export interface TenderResponse {
  id: string;
  professionalId: string;
  name: string;
  avatarUrl: string | null;
  rating: number;
  reviewCount: number;
  distanceKm: number | null;
  amount: number | null;
  message: string | null;
  status: 'INVITED' | 'IGNORED' | 'OFFERED' | 'REJECTED' | 'SELECTED' | 'NOT_SELECTED';
  offeredAt: string | null;
  serviceId: string | null;
  serviceName: string | null;
  negotiationId: string | null;
  reservationId: string | null;
  services: { id: string; name: string }[];
}
export interface Tender {
  id: string;
  categoryId: string;
  subCategoryId: string | null;
  job: string;
  description: string;
  address: string;
  latitude: number;
  longitude: number;
  radiusKm: number;
  proposedPrice: number;
  scheduledAt: string | null;
  status: 'OPEN' | 'SELECTED' | 'CANCELLED';
  revision: number;
  createdAt: string;
  clientName: string;
  clientAvatarUrl: string | null;
  invitedCount?: number;
  responses: TenderResponse[];
}
export interface CreateTender {
  categoryId: string;
  subCategoryId?: string;
  description: string;
  address: string;
  latitude: number;
  longitude: number;
  radiusKm: number;
  proposedPrice: number;
  scheduledAt?: string;
}
export interface TenderList {
  items: Tender[];
  page: number;
  total: number;
  limit: number;
}
export type TenderAction = {
  kind: 'cancel' | 'ignore' | 'republish' | 'respond' | 'reject' | 'select';
  responseId?: string;
  amount?: number;
  serviceId?: string;
  message?: string;
};
export const TENDER_STATUS_LABELS: Record<Tender['status'] | TenderResponse['status'], string> = {
  OPEN: 'Recherche en cours',
  SELECTED: 'Offre acceptée',
  CANCELLED: 'Demande annulée',
  INVITED: 'Nouvelle demande',
  IGNORED: 'Ignorée',
  OFFERED: 'En attente du client',
  REJECTED: 'Offre refusée',
  NOT_SELECTED: 'Non retenue',
};
