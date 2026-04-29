import { EventEmitter2 } from '@nestjs/event-emitter';
import { Inject, Injectable } from '@nestjs/common';
import type { AuthUser } from '../../../auth/security/auth-user.type';
import {
  DOMAINE_EVENT_BUS,
  type DomaineEventBusPort,
} from '../../../core/events/domaine-event-bus.port';
import { appHttpException } from '../../../core/http/app-http.exception';
import {
  PROFESSIONALS_REPOSITORY_PORT,
  type ProfessionalsRepositoryPort,
} from '../../../professionals/application/ports/professionals-repository.port';
import { ReservationClientNotificationService } from '../../../notifications/application/services/reservation-client-notification.service';
import { ProfessionalPresenceEntity } from '../../domain/entities/professional-presence.entity';
import { ReservationTrackingSessionEntity } from '../../domain/entities/reservation-tracking-session.entity';
import { LiveTrackingDomainError } from '../../domain/errors/live-tracking.domain-error';
import {
  LIVE_TRACKING_REPOSITORY_PORT,
  type LiveTrackingRepositoryPort,
} from '../ports/live-tracking-repository.port';
import type { TrackingLocationCommand } from '../commands/tracking-location.command';

@Injectable()
export class LiveTrackingCommandService {
  constructor(
    @Inject(LIVE_TRACKING_REPOSITORY_PORT)
    private readonly liveTrackingRepository: LiveTrackingRepositoryPort,
    @Inject(PROFESSIONALS_REPOSITORY_PORT)
    private readonly professionalsRepository: ProfessionalsRepositoryPort,
    @Inject(DOMAINE_EVENT_BUS)
    private readonly eventBus: DomaineEventBusPort,
    private readonly realtimeEvents: EventEmitter2,
    private readonly reservationClientNotificationService: ReservationClientNotificationService,
  ) {}

  async markOnTheWay(
    user: AuthUser,
    reservationId: string,
    dto: TrackingLocationCommand,
  ) {
    const professional = await this.requireProfessionalProfile(user);
    const context =
      await this.liveTrackingRepository.findReservationContext(reservationId);
    if (!context) {
      throw appHttpException('RESERVATIONS_NOT_FOUND');
    }

    if (context.professionalId !== professional.id) {
      throw appHttpException('RESERVATIONS_UNAUTHORIZED');
    }

    if (context.reservationStatus !== 'PAYEE_SEQUESTRE') {
      throw appHttpException('LIVE_TRACKING_INVALID_RESERVATION_STATUS');
    }

    this.assertLocationPair(dto);

    const presenceEntity = ProfessionalPresenceEntity.reconstitute(
      (await this.liveTrackingRepository.findProfessionalPresence(
        professional.id,
      )) ?? ProfessionalPresenceEntity.create(professional.id).toView(),
    );
    presenceEntity.markOnTheWay();
    if (dto.latitude !== undefined && dto.longitude !== undefined) {
      presenceEntity.updateLocation({
        latitude: dto.latitude,
        longitude: dto.longitude,
        accuracyMeters: dto.accuracyMeters ?? null,
        headingDegrees: dto.headingDegrees ?? null,
        speedKmh: dto.speedKmh ?? null,
        locationLabel: dto.locationLabel?.trim() ?? null,
      });
    }

    const session = ReservationTrackingSessionEntity.start({
      reservationId: context.reservationId,
      clientUserId: context.clientUserId,
      professionalId: context.professionalId,
      professionalUserId: context.professionalUserId,
      latitude: dto.latitude ?? null,
      longitude: dto.longitude ?? null,
      accuracyMeters: dto.accuracyMeters ?? null,
      headingDegrees: dto.headingDegrees ?? null,
      speedKmh: dto.speedKmh ?? null,
      locationLabel: dto.locationLabel?.trim() ?? null,
    });

    const tracking = await this.liveTrackingRepository.startOrResumeTracking({
      session: session.toView(),
      presence: presenceEntity.toView(),
    });

    await this.eventBus.publier({
      nom: 'live-tracking.session.started',
      dateOccurrence: new Date(),
      payload: {
        reservationId: tracking.reservationId,
        clientUserId: tracking.clientUserId,
        professionalId: tracking.professionalId,
        professionalUserId: tracking.professionalUserId,
        startedAt: tracking.startedAt?.toISOString() ?? null,
      },
    });

    this.realtimeEvents.emit(
      'live-tracking.presence.updated',
      tracking.presence,
    );

    await this.reservationClientNotificationService.notifyProfessionalOnTheWay({
      reservationId: context.reservationId,
      clientId: context.clientUserId,
      serviceName: context.serviceName,
      professionalName: context.professionalName,
      dateHeure: context.dateHeure,
      adresseClient: context.adresseClient,
    });

    return tracking;
  }

  async updateLocation(
    user: AuthUser,
    reservationId: string,
    dto: TrackingLocationCommand,
  ) {
    const professional = await this.requireProfessionalProfile(user);
    const context =
      await this.liveTrackingRepository.findReservationContext(reservationId);
    if (!context) {
      throw appHttpException('RESERVATIONS_NOT_FOUND');
    }
    if (context.professionalId !== professional.id) {
      throw appHttpException('RESERVATIONS_UNAUTHORIZED');
    }

    if (dto.latitude === undefined || dto.longitude === undefined) {
      throw LiveTrackingDomainError.invalidLocation();
    }

    const tracking = await this.liveTrackingRepository.recordTrackingLocation({
      reservationId,
      professionalId: professional.id,
      latitude: dto.latitude,
      longitude: dto.longitude,
      accuracyMeters: dto.accuracyMeters ?? null,
      headingDegrees: dto.headingDegrees ?? null,
      speedKmh: dto.speedKmh ?? null,
      locationLabel: dto.locationLabel?.trim() ?? null,
    });

    if (!tracking) {
      throw appHttpException('LIVE_TRACKING_ACTIVE_SESSION_REQUIRED');
    }

    this.realtimeEvents.emit('live-tracking.location.updated', tracking);
    this.realtimeEvents.emit(
      'live-tracking.presence.updated',
      tracking.presence,
    );

    return tracking;
  }

  async syncProfessionalConnection(user: AuthUser, isOnline: boolean) {
    if (user.role !== 'PRESTATAIRE') {
      return null;
    }

    const professional = await this.professionalsRepository.findByUserId(
      user.sub,
    );
    if (!professional) {
      return null;
    }

    const entity = ProfessionalPresenceEntity.reconstitute(
      (await this.liveTrackingRepository.findProfessionalPresence(
        professional.id,
      )) ?? ProfessionalPresenceEntity.create(professional.id).toView(),
    );
    if (isOnline) {
      entity.markOnline();
    } else {
      entity.markOffline();
    }

    const presence = await this.liveTrackingRepository.upsertPresence({
      professionalId: professional.id,
      isOnline: entity.toView().isOnline,
      status: entity.toView().status,
      latitude: entity.toView().lastLatitude,
      longitude: entity.toView().lastLongitude,
      accuracyMeters: entity.toView().lastAccuracyMeters,
      headingDegrees: entity.toView().lastHeadingDegrees,
      speedKmh: entity.toView().lastSpeedKmh,
      locationLabel: entity.toView().lastLocationLabel,
    });

    this.realtimeEvents.emit('live-tracking.presence.updated', presence);
    return presence;
  }

  async finalizeReservationTracking(input: {
    reservationId: string;
    professionalId: string;
    trackingStatus: 'TERMINEE' | 'ANNULEE';
    nextPresenceStatus: 'EN_LIGNE' | 'EN_PRESTATION' | 'HORS_LIGNE';
  }): Promise<void> {
    const tracking =
      await this.liveTrackingRepository.finalizeTrackingForReservation({
        reservationId: input.reservationId,
        professionalId: input.professionalId,
        trackingStatus: input.trackingStatus,
        nextPresenceStatus: input.nextPresenceStatus,
      });

    if (!tracking) {
      return;
    }

    await this.eventBus.publier({
      nom: 'live-tracking.session.completed',
      dateOccurrence: new Date(),
      payload: {
        reservationId: tracking.reservationId,
        professionalId: tracking.professionalId,
        trackingStatus: tracking.trackingStatus,
        endedAt: tracking.endedAt?.toISOString() ?? null,
      },
    });

    this.realtimeEvents.emit(
      'live-tracking.presence.updated',
      tracking.presence,
    );
  }

  private async requireProfessionalProfile(user: AuthUser) {
    if (user.role !== 'PRESTATAIRE') {
      throw appHttpException('RESERVATIONS_FORBIDDEN_ROLE');
    }

    const professional = await this.professionalsRepository.findByUserId(
      user.sub,
    );
    if (!professional) {
      throw appHttpException('LIVE_TRACKING_PROFESSIONAL_PROFILE_NOT_FOUND');
    }

    return professional;
  }

  private assertLocationPair(dto: TrackingLocationCommand): void {
    const hasLatitude = dto.latitude !== undefined;
    const hasLongitude = dto.longitude !== undefined;
    if (hasLatitude !== hasLongitude) {
      throw LiveTrackingDomainError.invalidLocation();
    }
  }
}
