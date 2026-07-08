import { Inject, Injectable } from '@nestjs/common';
import type { AuthUser } from '../../../auth/security/auth-user.type';
import { appHttpException } from '../../../core/http/app-http.exception';
import {
  PROFESSIONALS_REPOSITORY_PORT,
  type ProfessionalsRepositoryPort,
} from '../../../professionals/application/ports/professionals-repository.port';
import {
  LIVE_TRACKING_REPOSITORY_PORT,
  type LiveTrackingRepositoryPort,
  type ReservationTrackingContext,
  type ReservationTrackingView,
} from '../ports/live-tracking-repository.port';
import { ProfessionalPresenceEntity } from '../../domain/entities/professional-presence.entity';
import { TrackingRouteEstimatorService } from './tracking-route-estimator.service';

@Injectable()
export class LiveTrackingQueryService {
  constructor(
    @Inject(LIVE_TRACKING_REPOSITORY_PORT)
    private readonly liveTrackingRepository: LiveTrackingRepositoryPort,
    @Inject(PROFESSIONALS_REPOSITORY_PORT)
    private readonly professionalsRepository: ProfessionalsRepositoryPort,
    private readonly routeEstimator: TrackingRouteEstimatorService,
  ) {}

  async getReservationTracking(user: AuthUser, reservationId: string) {
    const context =
      await this.liveTrackingRepository.findReservationContext(reservationId);
    if (!context) {
      throw appHttpException('RESERVATIONS_NOT_FOUND');
    }

    this.assertReservationAccess(user, context);

    const tracking =
      await this.liveTrackingRepository.findTrackingByReservationId(
        reservationId,
      );
    if (tracking) {
      return this.enrichTrackingRoute(tracking, context);
    }

    const presence =
      (await this.liveTrackingRepository.findProfessionalPresence(
        context.professionalId,
      )) ?? ProfessionalPresenceEntity.create(context.professionalId).toView();

    return {
      reservationId: context.reservationId,
      clientUserId: context.clientUserId,
      professionalId: context.professionalId,
      professionalUserId: context.professionalUserId,
      trackingStatus: 'INACTIF' as const,
      startedAt: null,
      endedAt: null,
      lastLatitude: null,
      lastLongitude: null,
      lastAccuracyMeters: null,
      lastHeadingDegrees: null,
      lastSpeedKmh: null,
      lastLocationLabel: null,
      lastPositionAt: null,
      updatedAt: null,
      presence,
      route: null,
    };
  }

  async getProfessionalPresence(professionalId: string) {
    const professional =
      await this.professionalsRepository.findVerifiedById(professionalId);
    if (!professional) {
      throw appHttpException('PROFESSIONALS_PROFILE_NOT_FOUND');
    }

    return (
      (await this.liveTrackingRepository.findProfessionalPresence(
        professionalId,
      )) ?? ProfessionalPresenceEntity.create(professionalId).toView()
    );
  }

  private assertReservationAccess(
    user: AuthUser,
    context: {
      clientUserId: string;
      professionalUserId: string;
    },
  ): void {
    if (user.role === 'ADMIN') {
      return;
    }

    if (
      user.sub !== context.clientUserId &&
      user.sub !== context.professionalUserId
    ) {
      throw appHttpException('RESERVATIONS_UNAUTHORIZED');
    }
  }

  private enrichTrackingRoute(
    tracking: ReservationTrackingView,
    context: ReservationTrackingContext,
  ): Promise<ReservationTrackingView> {
    const destinationAddress =
      context.travelMode === 'CLIENT_SE_DEPLACE'
        ? context.adresseDestinationPrestataire
        : context.adresseClient;

    return this.routeEstimator.enrich(tracking, destinationAddress);
  }
}
