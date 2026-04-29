import { Inject, Injectable } from '@nestjs/common';
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
    entity.resolve({
      adminUserId: requestUser.sub,
      decision: input.decision,
      refundPercentage: normalizedPercentage,
      clientRefundAmount: 0,
      professionalPayoutAmount: 0,
      notes: input.notes,
    });

    const resolved = await this.disputesRepository.resolve({
      dispute: entity.toView(),
      decision: input.decision,
      clientRefundPercentage: normalizedPercentage,
    });

    await this.notifyPartiesAfterResolution(resolved.dispute);
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

  private assertAdmin(user: AuthUser): void {
    if (user.role !== 'ADMIN') {
      throw appHttpException('AUTH_TOKEN_INVALID');
    }
  }

  private resolvePriority(hasPayment: boolean): DisputePriority {
    return hasPayment ? 'HAUTE' : 'MOYENNE';
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
        },
      },
    ]);
  }

  private async notifyPartiesAfterRejection(input: {
    id: string;
    reservationId: string;
    client: { id: string };
    professional: { userId: string };
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
        },
      },
    ]);
  }
}
