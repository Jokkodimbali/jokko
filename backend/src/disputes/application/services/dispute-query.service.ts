import { Inject, Injectable } from '@nestjs/common';
import type { AuthUser } from '../../../auth/security/auth-user.type';
import { appHttpException } from '../../../core/http/app-http.exception';
import {
  DISPUTES_REPOSITORY_PORT,
  type DisputesRepositoryPort,
} from '../ports/disputes-repository.port';
import type {
  DisputePriority,
  DisputeStatus,
} from '../../domain/entities/dispute.entity';

@Injectable()
export class DisputeQueryService {
  constructor(
    @Inject(DISPUTES_REPOSITORY_PORT)
    private readonly disputesRepository: DisputesRepositoryPort,
  ) {}

  async listForAdmin(input: {
    status?: DisputeStatus;
    priority?: DisputePriority;
    limit?: number;
    cursor?: string;
  }) {
    const limit = Math.min(Math.max(input.limit ?? 20, 1), 100);
    const result = await this.disputesRepository.listForAdmin({
      status: input.status,
      priority: input.priority,
      limit,
      cursor: input.cursor,
    });

    return {
      items: result.items.map((item) => ({
        ...item,
        slaRemainingHours: this.computeSlaRemainingHours(item.ouvertLe),
      })),
      nextCursor: result.nextCursor,
    };
  }

  async getById(disputeId: string) {
    const dispute = await this.disputesRepository.findById(disputeId);
    if (!dispute) {
      throw appHttpException('DISPUTES_NOT_FOUND');
    }

    return {
      ...dispute,
      slaRemainingHours: this.computeSlaRemainingHours(dispute.ouvertLe),
    };
  }

  async getByReservationForUser(requestUser: AuthUser, reservationId: string) {
    const dispute =
      await this.disputesRepository.findByReservationId(reservationId);
    if (!dispute) {
      throw appHttpException('DISPUTES_NOT_FOUND');
    }

    if (
      requestUser.sub !== dispute.reporterUserId &&
      requestUser.sub !== dispute.client.id &&
      requestUser.sub !== dispute.professional.userId &&
      requestUser.role !== 'ADMIN'
    ) {
      throw appHttpException('AUTH_TOKEN_INVALID');
    }

    return {
      ...dispute,
      slaRemainingHours: this.computeSlaRemainingHours(dispute.ouvertLe),
    };
  }

  private computeSlaRemainingHours(openedAt: Date): number {
    const target = openedAt.getTime() + 24 * 60 * 60 * 1000;
    return Math.ceil((target - Date.now()) / (60 * 60 * 1000));
  }
}
