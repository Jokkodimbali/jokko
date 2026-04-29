import {
  ValidationError,
  ConflictError,
} from '../../../shared/domain/errors/domain-error';
import { domainMessage } from '../../../core/messages/domain-message.catalog';

export type DisputeStatus = 'OUVERT' | 'EN_REVUE' | 'RESOLU' | 'REJETE';
export type DisputePriority = 'BASSE' | 'MOYENNE' | 'HAUTE';
export type DisputeResolutionDecision =
  | 'REMBOURSER_CLIENT'
  | 'CREDITER_PRESTATAIRE'
  | 'PARTAGER';

export type Dispute = {
  id: string;
  reservationId: string;
  paiementId: string | null;
  reporterUserId: string;
  resolvedByAdminUserId: string | null;
  statut: DisputeStatus;
  priorite: DisputePriority;
  raison: string;
  notesInternes: string | null;
  decisionResolution: DisputeResolutionDecision | null;
  pourcentageRemboursementClient: number | null;
  montantRembourseClient: number | null;
  montantPrestataire: number | null;
  ouvertLe: Date;
  prisEnChargeLe: Date | null;
  resoluLe: Date | null;
  rejeteLe: Date | null;
  creeLe: Date;
  misAJourLe: Date;
};

const MIN_REASON_LENGTH = 10;
const MIN_NOTES_LENGTH = 10;
const MAX_NOTES_LENGTH = 1000;

export class DisputeEntity {
  private constructor(private readonly state: Dispute) {}

  static create(input: {
    id: string;
    reservationId: string;
    paiementId?: string | null;
    reporterUserId: string;
    raison: string;
    priorite?: DisputePriority;
  }): DisputeEntity {
    const reason = input.raison.trim();
    if (reason.length < MIN_REASON_LENGTH) {
      throw new ValidationError(
        'DISPUTE_REASON_TOO_SHORT',
        domainMessage('DISPUTE_REASON_TOO_SHORT'),
      );
    }

    return new DisputeEntity({
      id: input.id,
      reservationId: input.reservationId,
      paiementId: input.paiementId ?? null,
      reporterUserId: input.reporterUserId,
      resolvedByAdminUserId: null,
      statut: 'OUVERT',
      priorite: input.priorite ?? 'MOYENNE',
      raison: reason,
      notesInternes: null,
      decisionResolution: null,
      pourcentageRemboursementClient: null,
      montantRembourseClient: null,
      montantPrestataire: null,
      ouvertLe: new Date(),
      prisEnChargeLe: null,
      resoluLe: null,
      rejeteLe: null,
      creeLe: new Date(),
      misAJourLe: new Date(),
    });
  }

  static reconstitute(state: Dispute): DisputeEntity {
    return new DisputeEntity({ ...state });
  }

  markInReview(adminUserId: string): void {
    if (this.state.statut !== 'OUVERT') {
      throw new ConflictError(
        'DISPUTE_INVALID_STATUS',
        domainMessage('DISPUTE_INVALID_STATUS_IN_REVIEW'),
      );
    }

    this.state.statut = 'EN_REVUE';
    this.state.resolvedByAdminUserId = adminUserId;
    this.state.prisEnChargeLe = new Date();
    this.touch();
  }

  resolve(input: {
    adminUserId: string;
    decision: DisputeResolutionDecision;
    refundPercentage: number;
    clientRefundAmount: number;
    professionalPayoutAmount: number;
    notes: string;
  }): void {
    if (!this.isReviewable()) {
      throw new ConflictError(
        'DISPUTE_INVALID_STATUS',
        domainMessage('DISPUTE_INVALID_STATUS_RESOLVE'),
      );
    }

    const notes = input.notes.trim();
    if (notes.length < MIN_NOTES_LENGTH || notes.length > MAX_NOTES_LENGTH) {
      throw new ValidationError(
        'DISPUTE_INVALID_NOTES',
        domainMessage('DISPUTE_INVALID_RESOLUTION_NOTES'),
      );
    }

    if (input.refundPercentage < 0 || input.refundPercentage > 100) {
      throw new ValidationError(
        'DISPUTE_INVALID_REFUND_PERCENTAGE',
        domainMessage('DISPUTE_INVALID_REFUND_PERCENTAGE'),
      );
    }

    this.state.statut = 'RESOLU';
    this.state.resolvedByAdminUserId = input.adminUserId;
    this.state.notesInternes = notes;
    this.state.decisionResolution = input.decision;
    this.state.pourcentageRemboursementClient = input.refundPercentage;
    this.state.montantRembourseClient = input.clientRefundAmount;
    this.state.montantPrestataire = input.professionalPayoutAmount;
    this.state.resoluLe = new Date();
    this.state.rejeteLe = null;
    this.touch();
  }

  reject(input: { adminUserId: string; notes: string }): void {
    if (!this.isReviewable()) {
      throw new ConflictError(
        'DISPUTE_INVALID_STATUS',
        domainMessage('DISPUTE_INVALID_STATUS_REJECT'),
      );
    }

    const notes = input.notes.trim();
    if (notes.length < MIN_NOTES_LENGTH || notes.length > MAX_NOTES_LENGTH) {
      throw new ValidationError(
        'DISPUTE_INVALID_NOTES',
        domainMessage('DISPUTE_INVALID_REJECTION_NOTES'),
      );
    }

    this.state.statut = 'REJETE';
    this.state.resolvedByAdminUserId = input.adminUserId;
    this.state.notesInternes = notes;
    this.state.rejeteLe = new Date();
    this.state.resoluLe = null;
    this.touch();
  }

  attachPayment(paymentId: string): void {
    if (!this.state.paiementId) {
      this.state.paiementId = paymentId;
      this.touch();
    }
  }

  toView(): Dispute {
    return { ...this.state };
  }

  private isReviewable(): boolean {
    return this.state.statut === 'OUVERT' || this.state.statut === 'EN_REVUE';
  }

  private touch(): void {
    this.state.misAJourLe = new Date();
  }
}
