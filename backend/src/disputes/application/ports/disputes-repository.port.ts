import type {
  Dispute,
  DisputePriority,
  DisputeResolutionDecision,
  DisputeStatus,
} from '../../domain/entities/dispute.entity';

export type DisputeAdminListFilters = {
  status?: DisputeStatus;
  priority?: DisputePriority;
  limit: number;
  cursor?: string;
};

export type DisputeAdminListItem = Dispute & {
  reservation: {
    id: string;
    statut: string;
    dateHeure: Date;
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
      creeLe: Date;
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
      creeLe: Date;
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
  evidence: Array<{
    id: string;
    uploaderUserId: string;
    originalFileName: string;
    mimeType: string;
    sizeBytes: number;
    fileUrl: string;
    createdAt: Date;
    uploader: {
      id: string;
      nom: string;
      role: string;
    };
  }>;
};

export type DisputeListResult = {
  items: DisputeAdminListItem[];
  nextCursor: string | null;
};

export type DisputeResolutionResult = {
  dispute: DisputeAdminListItem;
  clientRefundAmount: number;
  professionalPayoutAmount: number;
};

export interface DisputesRepositoryPort {
  findById(id: string): Promise<DisputeAdminListItem | null>;
  findByReservationId(
    reservationId: string,
  ): Promise<DisputeAdminListItem | null>;
  createOrGetOpenForReservation(input: {
    dispute: Dispute;
    paymentId?: string | null;
  }): Promise<DisputeAdminListItem>;
  createOrGetOpenForPayment(input: {
    dispute: Dispute;
    paymentId: string;
  }): Promise<DisputeAdminListItem>;
  listForAdmin(filters: DisputeAdminListFilters): Promise<DisputeListResult>;
  markInReview(
    disputeId: string,
    adminUserId: string,
  ): Promise<DisputeAdminListItem | null>;
  reject(dispute: Dispute): Promise<DisputeAdminListItem>;
  resolve(input: {
    dispute: Dispute;
    decision: DisputeResolutionDecision;
    clientRefundPercentage: number;
  }): Promise<DisputeResolutionResult>;
  createEvidence(input: {
    disputeId: string;
    uploaderUserId: string;
    files: Array<{
      originalFileName: string;
      mimeType: string;
      sizeBytes: number;
      fileUrl: string;
    }>;
  }): Promise<DisputeAdminListItem>;
  listAdminUserIds(): Promise<string[]>;
}

export const DISPUTES_REPOSITORY_PORT = Symbol('DISPUTES_REPOSITORY_PORT');
