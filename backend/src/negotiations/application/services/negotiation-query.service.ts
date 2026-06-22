import { Injectable } from '@nestjs/common';
import type { AuthUser } from '../../../auth/security/auth-user.type';
import { appHttpException } from '../../../core/http/app-http.exception';
import type { ListNegotiationsQuery } from '../commands/negotiations.commands';
import { NegotiationAppService } from './negotiation-app-service.base';

@Injectable()
export class NegotiationQueryService extends NegotiationAppService {
  async listMyNegotiations(
    requestUser: AuthUser,
    query: ListNegotiationsQuery,
  ) {
    const scope =
      (requestUser.role === 'PRESTATAIRE' || requestUser.role === 'MEDECIN') &&
      query.scope !== 'CLIENT'
        ? 'PRESTATAIRE'
        : 'CLIENT';

    if (scope === 'PRESTATAIRE') {
      this.assertProfessionalRole(requestUser.role);
    } else {
      this.assertClientRole(requestUser.role);
    }

    return this.negotiationsRepository.listByActor({
      userId: requestUser.sub,
      scope,
      status: query.status,
      limit: this.normalizeLimit(query.limit),
      offset: this.normalizeOffset(query.offset),
    });
  }

  async getNegotiationById(requestUser: AuthUser, negotiationId: string) {
    const negotiation = await this.getNegotiationOrThrow(negotiationId);

    if (negotiation.clientId === requestUser.sub) {
      return negotiation;
    }

    if (requestUser.role === 'PRESTATAIRE' || requestUser.role === 'MEDECIN') {
      const profile = await this.getProfessionalProfileOrThrow(requestUser.sub);
      if (profile.id === negotiation.professionnelId) {
        return negotiation;
      }
    }

    throw appHttpException('NEGOTIATIONS_UNAUTHORIZED');
  }

  async getAcceptedNegotiationForReservation(
    requestUser: AuthUser,
    negotiationId: string,
  ) {
    this.assertClientRole(requestUser.role);
    const negotiation = await this.getNegotiationById(
      requestUser,
      negotiationId,
    );

    if (negotiation.clientId !== requestUser.sub) {
      throw appHttpException('NEGOTIATIONS_UNAUTHORIZED');
    }

    if (negotiation.reservationId) {
      throw appHttpException('NEGOTIATIONS_ALREADY_CONVERTED');
    }

    if (negotiation.statut !== 'ACCEPTEE') {
      throw appHttpException('NEGOTIATIONS_ACCEPTED_REQUIRED');
    }

    return negotiation;
  }
}
