import { Inject, Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { randomUUID } from 'node:crypto';
import type { AuthUser } from '../../../auth/security/auth-user.type';
import {
  DOMAINE_EVENT_BUS,
  type DomaineEventBusPort,
} from '../../../core/events/domaine-event-bus.port';
import { appHttpException } from '../../../core/http/app-http.exception';
import { DISPUTE_NOTIFICATION_MESSAGES } from '../../../core/messages/dispute-notification.messages';
import { NotificationsService } from '../../../notifications/application/services/notifications.service';
import { NOTIFICATION_TYPES } from '../../../notifications/domain/entities/notification.entity';
import {
  DisputeEntity,
  type DisputePriority,
  type DisputeResolutionDecision,
} from '../../domain/entities/dispute.entity';
import {
  DISPUTES_REPOSITORY_PORT,
  type DisputesRepositoryPort,
} from '../ports/disputes-repository.port';

@Injectable()
export class DisputeCommandService {
  constructor(
    @Inject(DISPUTES_REPOSITORY_PORT)
    private readonly disputesRepository: DisputesRepositoryPort,
    @Inject(DOMAINE_EVENT_BUS)
    private readonly eventBus: DomaineEventBusPort,
    private readonly notificationsService: NotificationsService,
    private readonly realtimeEvents: EventEmitter2,
  ) {}

  async openForReservation(input: {
    reservationId: string;
    reporterUserId: string;
    paymentId?: string | null;
    reason: string;
  }) {
    const dispute = DisputeEntity.create({
      id: randomUUID(),
      reservationId: input.reservationId,
      paiementId: input.paymentId,
      reporterUserId: input.reporterUserId,
      raison: input.reason,
      priorite: this.resolvePriority(Boolean(input.paymentId)),
    });

    const created = await this.disputesRepository.createOrGetOpenForReservation(
      {
        dispute: dispute.toView(),
        paymentId: input.paymentId,
      },
    );

    await this.notifyAdminsAboutOpenedDispute(
      created.id,
      created.reservationId,
    );
    await this.eventBus.publier({
      nom: 'disputes.opened',
      dateOccurrence: new Date(),
      payload: {
        disputeId: created.id,
        reservationId: created.reservationId,
        paymentId: created.paiementId,
        reporterUserId: created.reporterUserId,
        status: created.statut,
        priority: created.priorite,
      },
    });

    return created;
  }

  async openForPayment(input: {
    paymentId: string;
    reservationId: string;
    reporterUserId: string;
    reason: string;
  }) {
    const dispute = DisputeEntity.create({
      id: randomUUID(),
      reservationId: input.reservationId,
      paiementId: input.paymentId,
      reporterUserId: input.reporterUserId,
      raison: input.reason,
      priorite: 'HAUTE',
    });

    const created = await this.disputesRepository.createOrGetOpenForPayment({
      dispute: dispute.toView(),
      paymentId: input.paymentId,
    });

    await this.notifyAdminsAboutOpenedDispute(
      created.id,
      created.reservationId,
    );
    await this.eventBus.publier({
      nom: 'disputes.opened',
      dateOccurrence: new Date(),
      payload: {
        disputeId: created.id,
        reservationId: created.reservationId,
        paymentId: created.paiementId,
        reporterUserId: created.reporterUserId,
        status: created.statut,
        priority: created.priorite,
      },
    });

    return created;
  }

  async markInReview(requestUser: AuthUser, disputeId: string) {
    this.assertAdmin(requestUser);
    const current = await this.disputesRepository.findById(disputeId);
    if (!current) {
      throw appHttpException('DISPUTES_NOT_FOUND');
    }

    const entity = DisputeEntity.reconstitute(current);
    entity.markInReview(requestUser.sub);
    const updated = await this.disputesRepository.markInReview(
      disputeId,
      requestUser.sub,
    );

    if (!updated) {
      throw appHttpException('DISPUTES_INVALID_STATUS');
    }

    await this.eventBus.publier({
      nom: 'disputes.in-review',
      dateOccurrence: new Date(),
      payload: {
        disputeId: updated.id,
        reservationId: updated.reservationId,
        adminUserId: requestUser.sub,
      },
    });

    return updated;
  }

  async resolve(
    requestUser: AuthUser,
    disputeId: string,
    input: {
      decision: DisputeResolutionDecision;
      clientRefundPercentage?: number;
      notes: string;
    },
  ) {
    this.assertAdmin(requestUser);
    const current = await this.disputesRepository.findById(disputeId);
    if (!current) {
      throw appHttpException('DISPUTES_NOT_FOUND');
    }

    const normalizedPercentage = this.normalizeRefundPercentage(
      input.decision,
      input.clientRefundPercentage,
    );
    const entity = DisputeEntity.reconstitute(current);
    const clientRefundAmount = this.calculateClientRefundAmount(
      current.payment?.montant ?? 0,
      normalizedPercentage,
    );
    entity.resolve({
      adminUserId: requestUser.sub,
      decision: input.decision,
      refundPercentage: normalizedPercentage,
      clientRefundAmount: 0,
      professionalPayoutAmount: 0,
      notes: input.notes,
    });

    // The external refund is completed first. If the provider refuses it, the
    // dispute stays open and no professional credit can be issued.
    if (current.paiementId && clientRefundAmount > 0) {
      await this.realtimeEvents.emitAsync('disputes.refund.requested', {
        disputeId: current.id,
        paymentId: current.paiementId,
        amount: clientRefundAmount,
        reason: input.notes.trim(),
      });
    }

    const resolved = await this.disputesRepository.resolve({
      dispute: entity.toView(),
      decision: input.decision,
      clientRefundPercentage: normalizedPercentage,
    });

    await this.notifyPartiesAfterResolution(resolved.dispute);
    await this.notifyProfessionalWalletCredit({
      professionalUserId: resolved.dispute.professional.userId,
      paymentId: resolved.dispute.paiementId,
      reservationId: resolved.dispute.reservationId,
      amount: resolved.professionalPayoutAmount,
      source: 'resolution du litige',
      serviceName: resolved.dispute.reservation.service.nom,
    });
    await this.eventBus.publier({
      nom: 'disputes.resolved',
      dateOccurrence: new Date(),
      payload: {
        disputeId: resolved.dispute.id,
        reservationId: resolved.dispute.reservationId,
        paymentId: resolved.dispute.paiementId,
        decision: resolved.dispute.decisionResolution,
        clientRefundAmount: resolved.clientRefundAmount,
        professionalPayoutAmount: resolved.professionalPayoutAmount,
      },
    });

    return resolved;
  }

  async reject(
    requestUser: AuthUser,
    disputeId: string,
    input: { notes: string },
  ) {
    this.assertAdmin(requestUser);
    const current = await this.disputesRepository.findById(disputeId);
    if (!current) {
      throw appHttpException('DISPUTES_NOT_FOUND');
    }

    const entity = DisputeEntity.reconstitute(current);
    entity.reject({
      adminUserId: requestUser.sub,
      notes: input.notes,
    });

    const rejected = await this.disputesRepository.reject(entity.toView());
    await this.notifyPartiesAfterRejection(rejected);
    await this.notifyProfessionalWalletCredit({
      professionalUserId: rejected.professional.userId,
      paymentId: rejected.paiementId,
      reservationId: rejected.reservationId,
      amount: rejected.payment?.montantNet ?? 0,
      source: 'rejet du litige',
      serviceName: rejected.reservation.service.nom,
    });
    await this.eventBus.publier({
      nom: 'disputes.rejected',
      dateOccurrence: new Date(),
      payload: {
        disputeId: rejected.id,
        reservationId: rejected.reservationId,
        paymentId: rejected.paiementId,
      },
    });

    return rejected;
  }

  async addEvidenceForReservation(
    requestUser: AuthUser,
    reservationId: string,
    files: Array<{
      originalFileName: string;
      mimeType: string;
      sizeBytes: number;
      fileUrl: string;
    }>,
  ) {
    if (files.length === 0) {
      throw appHttpException('VALIDATION_REQUEST_INVALID');
    }

    const current =
      await this.disputesRepository.findByReservationId(reservationId);
    if (!current) {
      throw appHttpException('DISPUTES_NOT_FOUND');
    }

    if (
      requestUser.sub !== current.reporterUserId &&
      requestUser.sub !== current.client.id &&
      requestUser.sub !== current.professional.userId
    ) {
      throw appHttpException('AUTH_TOKEN_INVALID');
    }

    if (!['OUVERT', 'EN_REVUE'].includes(current.statut)) {
      throw appHttpException('DISPUTES_INVALID_STATUS');
    }

    const updated = await this.disputesRepository.createEvidence({
      disputeId: current.id,
      uploaderUserId: requestUser.sub,
      files,
    });

    await this.eventBus.publier({
      nom: 'disputes.evidence-added',
      dateOccurrence: new Date(),
      payload: {
        disputeId: updated.id,
        reservationId: updated.reservationId,
        uploaderUserId: requestUser.sub,
        filesCount: files.length,
      },
    });

    return updated;
  }

  async deleteEvidenceForReservation(
    requestUser: AuthUser,
    reservationId: string,
    evidenceId: string,
  ) {
    const current =
      await this.disputesRepository.findByReservationId(reservationId);
    if (!current) {
      throw appHttpException('DISPUTES_NOT_FOUND');
    }

    const evidence = current.evidence.find((item) => item.id === evidenceId);
    if (!evidence) {
      throw appHttpException('VALIDATION_REQUEST_INVALID');
    }

    if (
      requestUser.sub !== evidence.uploaderUserId &&
      requestUser.role !== 'ADMIN'
    ) {
      throw appHttpException('AUTH_TOKEN_INVALID');
    }

    if (!['OUVERT', 'EN_REVUE'].includes(current.statut)) {
      throw appHttpException('DISPUTES_INVALID_STATUS');
    }

    const updated = await this.disputesRepository.deleteEvidence(evidenceId);
    if (!updated) {
      throw appHttpException('DISPUTES_NOT_FOUND');
    }

    await this.eventBus.publier({
      nom: 'disputes.evidence-deleted',
      dateOccurrence: new Date(),
      payload: {
        disputeId: updated.id,
        reservationId: updated.reservationId,
        uploaderUserId: requestUser.sub,
        evidenceId,
      },
    });

    return updated;
  }

  private assertAdmin(user: AuthUser): void {
    if (user.role !== 'ADMIN') {
      throw appHttpException('AUTH_TOKEN_INVALID');
    }
  }

  private resolvePriority(hasPayment: boolean): DisputePriority {
    return hasPayment ? 'HAUTE' : 'MOYENNE';
  }

  private calculateClientRefundAmount(grossAmount: number, percentage: number): number {
    return Math.round(grossAmount * (percentage / 100) * 100) / 100;
  }

  private normalizeRefundPercentage(
    decision: DisputeResolutionDecision,
    percentage?: number,
  ): number {
    if (decision === 'REMBOURSER_CLIENT') {
      return 100;
    }

    if (decision === 'CREDITER_PRESTATAIRE') {
      return 0;
    }

    if (typeof percentage !== 'number') {
      return 50;
    }

    return percentage;
  }

  private async notifyAdminsAboutOpenedDispute(
    disputeId: string,
    reservationId: string,
  ): Promise<void> {
    const adminUserIds = await this.disputesRepository.listAdminUserIds();
    if (adminUserIds.length === 0) {
      return;
    }

    await this.notificationsService.createManyInAppNotifications(
      adminUserIds.map((userId) => ({
        userId,
        type: NOTIFICATION_TYPES.LITIGE_OUVERT,
        title: DISPUTE_NOTIFICATION_MESSAGES.ADMIN_DISPUTE_OPENED_TITLE,
        body: DISPUTE_NOTIFICATION_MESSAGES.ADMIN_DISPUTE_OPENED_BODY(
          reservationId,
        ),
        data: {
          disputeId,
          reservationId,
          opened: true,
        },
      })),
    );
  }

  private async notifyPartiesAfterResolution(input: {
    id: string;
    reservationId: string;
    client: { id: string };
    professional: { userId: string };
    reservation: { service: { nom: string } };
    decisionResolution: DisputeResolutionDecision | null;
  }): Promise<void> {
    const decision =
      input.decisionResolution &&
      DISPUTE_NOTIFICATION_MESSAGES.DECISION_LABELS[input.decisionResolution];
    const body = DISPUTE_NOTIFICATION_MESSAGES.DISPUTE_RESOLVED_BODY(
      decision ?? 'dossier traite',
    );

    await this.notificationsService.createManyInAppNotifications([
      {
        userId: input.client.id,
        type: NOTIFICATION_TYPES.LITIGE_RESOLU,
        title: DISPUTE_NOTIFICATION_MESSAGES.DISPUTE_RESOLVED_TITLE,
        body,
        data: {
          disputeId: input.id,
          reservationId: input.reservationId,
          decision: input.decisionResolution,
          serviceName: input.reservation.service.nom,
        },
      },
      {
        userId: input.professional.userId,
        type: NOTIFICATION_TYPES.LITIGE_RESOLU,
        title: DISPUTE_NOTIFICATION_MESSAGES.DISPUTE_RESOLVED_TITLE,
        body,
        data: {
          disputeId: input.id,
          reservationId: input.reservationId,
          decision: input.decisionResolution,
          serviceName: input.reservation.service.nom,
        },
      },
    ]);
  }

  private async notifyProfessionalWalletCredit(input: {
    professionalUserId: string;
    paymentId: string | null;
    reservationId: string;
    amount: number;
    source: string;
    serviceName: string;
  }): Promise<void> {
    if (!input.paymentId || input.amount <= 0) return;

    await this.notificationsService.createInAppNotification({
      userId: input.professionalUserId,
      type: NOTIFICATION_TYPES.PAIEMENT_LIBERE,
      title: 'Paiement reçu',
      body: `${input.amount.toLocaleString('fr-FR')} FCFA ont été crédités dans votre portefeuille après ${input.source}.`,
      data: {
        paymentId: input.paymentId,
        reservationId: input.reservationId,
        amount: input.amount,
        walletCredit: true,
        source: 'dispute',
        serviceName: input.serviceName,
      },
    });
  }

  private async notifyPartiesAfterRejection(input: {
    id: string;
    reservationId: string;
    client: { id: string };
    professional: { userId: string };
    reservation: { service: { nom: string } };
  }): Promise<void> {
    await this.notificationsService.createManyInAppNotifications([
      {
        userId: input.client.id,
        type: NOTIFICATION_TYPES.LITIGE_RESOLU,
        title: DISPUTE_NOTIFICATION_MESSAGES.DISPUTE_REJECTED_TITLE,
        body: DISPUTE_NOTIFICATION_MESSAGES.DISPUTE_REJECTED_BODY,
        data: {
          disputeId: input.id,
          reservationId: input.reservationId,
          rejected: true,
          serviceName: input.reservation.service.nom,
        },
      },
      {
        userId: input.professional.userId,
        type: NOTIFICATION_TYPES.LITIGE_RESOLU,
        title: DISPUTE_NOTIFICATION_MESSAGES.DISPUTE_REJECTED_TITLE,
        body: DISPUTE_NOTIFICATION_MESSAGES.DISPUTE_REJECTED_BODY,
        data: {
          disputeId: input.id,
          reservationId: input.reservationId,
          rejected: true,
          serviceName: input.reservation.service.nom,
        },
      },
    ]);
  }
}
