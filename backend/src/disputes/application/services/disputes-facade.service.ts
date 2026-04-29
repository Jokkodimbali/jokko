import { Injectable } from '@nestjs/common';
import type { AuthUser } from '../../../auth/security/auth-user.type';
import { DisputeCommandService } from './dispute-command.service';
import { DisputeQueryService } from './dispute-query.service';
import type {
  DisputePriority,
  DisputeResolutionDecision,
  DisputeStatus,
} from '../../domain/entities/dispute.entity';

@Injectable()
export class DisputesFacade {
  constructor(
    private readonly disputeCommandService: DisputeCommandService,
    private readonly disputeQueryService: DisputeQueryService,
  ) {}

  openForReservation(input: {
    reservationId: string;
    reporterUserId: string;
    paymentId?: string | null;
    reason: string;
  }) {
    return this.disputeCommandService.openForReservation(input);
  }

  openForPayment(input: {
    paymentId: string;
    reservationId: string;
    reporterUserId: string;
    reason: string;
  }) {
    return this.disputeCommandService.openForPayment(input);
  }

  listForAdmin(input: {
    status?: DisputeStatus;
    priority?: DisputePriority;
    limit?: number;
    cursor?: string;
  }) {
    return this.disputeQueryService.listForAdmin(input);
  }

  getById(disputeId: string) {
    return this.disputeQueryService.getById(disputeId);
  }

  markInReview(requestUser: AuthUser, disputeId: string) {
    return this.disputeCommandService.markInReview(requestUser, disputeId);
  }

  resolve(
    requestUser: AuthUser,
    disputeId: string,
    input: {
      decision: DisputeResolutionDecision;
      clientRefundPercentage?: number;
      notes: string;
    },
  ) {
    return this.disputeCommandService.resolve(requestUser, disputeId, input);
  }

  reject(requestUser: AuthUser, disputeId: string, input: { notes: string }) {
    return this.disputeCommandService.reject(requestUser, disputeId, input);
  }
}
