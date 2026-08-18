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
  ProviderLocationUpdatedEvent,
  ProviderStartedTripEvent,
} from '../../domain/events/tracking-domain.events';
import { ProviderArrivedEvent } from '../../../reservations/domain/events/reservation-mission.events';
import {
  LIVE_TRACKING_REPOSITORY_PORT,
  type ReservationTrackingContext,
  type ReservationTrackingView,
  type LiveTrackingRepositoryPort,
} from '../ports/live-tracking-repository.port';
import type { TrackingLocationCommand } from '../commands/tracking-location.command';
import { TrackingRouteEstimatorService } from './tracking-route-estimator.service';
import { resolveTrackingDestinationAddress } from './tracking-parcel-destination.helper';

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
    private readonly routeEstimator: TrackingRouteEstimatorService,
  ) {}

  async markOnTheWay(
    user: AuthUser,
    reservationId: string,
    dto: TrackingLocationCommand,
  ) {
    const context =
      await this.liveTrackingRepository.findReservationContext(reservationId);
    if (!context) {
      throw appHttpException('RESERVATIONS_NOT_FOUND');
    }

    if (context.travelMode === 'CLIENT_SE_DEPLACE') {
      return this.markClientOnTheWay(user, context, dto);
    }

    const professional = await this.requireProfessionalProfile(user);
    if (context.professionalId !== professional.id) {
      throw appHttpException('RESERVATIONS_UNAUTHORIZED');
    }

    if (context.reservationStatus !== 'PAYEE_SEQUESTRE') {
      throw appHttpException('LIVE_TRACKING_INVALID_RESERVATION_STATUS');
    }

    this.assertLocationPair(dto);
    this.assertTelemetry(dto);
    const recordedAt =
      dto.latitude !== undefined && dto.longitude !== undefined
        ? this.resolveRecordedAt(dto)
        : new Date();

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
      recordedAt,
    });

    const tracking = await this.liveTrackingRepository.startOrResumeTracking({
      session: session.toView(),
      presence: presenceEntity.toView(),
    });

    await this.eventBus.publier(
      new ProviderStartedTripEvent({
        reservationId: tracking.reservationId,
        clientUserId: tracking.clientUserId,
        professionalId: tracking.professionalId,
        startedAt:
          tracking.startedAt?.toISOString() ?? new Date().toISOString(),
      }),
    );

    const enrichedTracking = await this.enrichTrackingRoute(tracking, context);
    this.publishLocationRealtime(enrichedTracking);
    this.publishRouteMetadataRealtime(enrichedTracking);
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

    return enrichedTracking;
  }

  async updateLocation(
    user: AuthUser,
    reservationId: string,
    dto: TrackingLocationCommand,
  ) {
    return (await this.updateLocationWithAcceptance(user, reservationId, dto))
      .tracking;
  }

  async updateLocationWithAcceptance(
    user: AuthUser,
    reservationId: string,
    dto: TrackingLocationCommand,
  ): Promise<{ tracking: ReservationTrackingView; accepted: boolean }> {
    const context =
      await this.liveTrackingRepository.findReservationContext(reservationId);
    if (!context) {
      throw appHttpException('RESERVATIONS_NOT_FOUND');
    }

    if (context.travelMode === 'CLIENT_SE_DEPLACE') {
      return this.updateClientLocation(user, context, dto);
    }

    const professional = await this.requireProfessionalProfile(user);
    if (context.professionalId !== professional.id) {
      throw appHttpException('RESERVATIONS_UNAUTHORIZED');
    }

    this.assertLocationPair(dto);
    this.assertTelemetry(dto);
    if (dto.latitude === undefined || dto.longitude === undefined) {
      throw LiveTrackingDomainError.invalidLocation();
    }

    const recordedAt = this.resolveRecordedAt(dto);
    const write = await this.liveTrackingRepository.recordTrackingLocation({
      reservationId,
      professionalId: professional.id,
      latitude: dto.latitude,
      longitude: dto.longitude,
      accuracyMeters: dto.accuracyMeters ?? null,
      headingDegrees: dto.headingDegrees ?? null,
      speedKmh: dto.speedKmh ?? null,
      locationLabel: dto.locationLabel?.trim() ?? null,
      recordedAt,
    });

    if (!write) {
      const resumed = await this.resumeParcelProviderTrackingFromLocation(
        context,
        professional.id,
        dto,
        recordedAt,
      );
      if (!resumed) {
        throw appHttpException('LIVE_TRACKING_ACTIVE_SESSION_REQUIRED');
      }
      this.publishTrackingUpdate(resumed, context, dto, recordedAt);
      return { tracking: resumed, accepted: true };
    }

    if (!write.accepted) {
      return write;
    }

    this.publishTrackingUpdate(write.tracking, context, dto, recordedAt);
    this.realtimeEvents.emit(
      'live-tracking.presence.updated',
      write.tracking.presence,
    );

    return write;
  }

  private async resumeParcelProviderTrackingFromLocation(
    context: ReservationTrackingContext,
    professionalId: string,
    dto: TrackingLocationCommand,
    recordedAt: Date,
  ) {
    if (
      context.travelMode !== 'TRANSPORT_COLIS' ||
      (context.reservationStatus !== 'PAYEE_SEQUESTRE' &&
        context.reservationStatus !== 'EN_COURS') ||
      dto.latitude === undefined ||
      dto.longitude === undefined
    ) {
      return null;
    }

    const presenceEntity = ProfessionalPresenceEntity.reconstitute(
      (await this.liveTrackingRepository.findProfessionalPresence(
        professionalId,
      )) ?? ProfessionalPresenceEntity.create(professionalId).toView(),
    );
    presenceEntity.markOnTheWay();
    presenceEntity.updateLocation({
      latitude: dto.latitude,
      longitude: dto.longitude,
      accuracyMeters: dto.accuracyMeters ?? null,
      headingDegrees: dto.headingDegrees ?? null,
      speedKmh: dto.speedKmh ?? null,
      locationLabel: dto.locationLabel?.trim() ?? null,
    });

    const session = ReservationTrackingSessionEntity.start({
      reservationId: context.reservationId,
      clientUserId: context.clientUserId,
      professionalId: context.professionalId,
      professionalUserId: context.professionalUserId,
      latitude: dto.latitude,
      longitude: dto.longitude,
      accuracyMeters: dto.accuracyMeters ?? null,
      headingDegrees: dto.headingDegrees ?? null,
      speedKmh: dto.speedKmh ?? null,
      locationLabel: dto.locationLabel?.trim() ?? null,
      recordedAt,
    });

    return this.liveTrackingRepository.startOrResumeTracking({
      session: session.toView(),
      presence: presenceEntity.toView(),
    });
  }

  private async markClientOnTheWay(
    user: AuthUser,
    context: ReservationTrackingContext,
    dto: TrackingLocationCommand,
  ) {
    if (user.sub !== context.clientUserId) {
      throw appHttpException('RESERVATIONS_UNAUTHORIZED');
    }

    if (context.reservationStatus !== 'PAYEE_SEQUESTRE') {
      throw appHttpException('LIVE_TRACKING_INVALID_RESERVATION_STATUS');
    }

    this.assertLocationPair(dto);
    this.assertTelemetry(dto);
    const recordedAt =
      dto.latitude !== undefined && dto.longitude !== undefined
        ? this.resolveRecordedAt(dto)
        : new Date();

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
      locationLabel: dto.locationLabel?.trim() ?? 'Position GPS du client',
      recordedAt,
    });

    const tracking =
      await this.liveTrackingRepository.startOrResumeTravelerTracking({
        session: session.toView(),
      });
    const enrichedTracking = await this.enrichTrackingRoute(tracking, context);

    this.publishLocationRealtime(enrichedTracking);
    this.publishRouteMetadataRealtime(enrichedTracking);

    return enrichedTracking;
  }

  private async updateClientLocation(
    user: AuthUser,
    context: ReservationTrackingContext,
    dto: TrackingLocationCommand,
  ) {
    if (user.sub !== context.clientUserId) {
      throw appHttpException('RESERVATIONS_UNAUTHORIZED');
    }

    this.assertLocationPair(dto);
    this.assertTelemetry(dto);
    if (dto.latitude === undefined || dto.longitude === undefined) {
      throw LiveTrackingDomainError.invalidLocation();
    }

    const recordedAt = this.resolveRecordedAt(dto);
    const write =
      await this.liveTrackingRepository.recordTravelerTrackingLocation({
        reservationId: context.reservationId,
        professionalId: context.professionalId,
        latitude: dto.latitude,
        longitude: dto.longitude,
        accuracyMeters: dto.accuracyMeters ?? null,
        headingDegrees: dto.headingDegrees ?? null,
        speedKmh: dto.speedKmh ?? null,
        locationLabel: dto.locationLabel?.trim() ?? 'Position GPS du client',
        recordedAt,
      });

    if (!write) {
      throw appHttpException('LIVE_TRACKING_ACTIVE_SESSION_REQUIRED');
    }
    if (!write.accepted) return write;

    this.publishTrackingUpdate(write.tracking, context, dto, recordedAt);

    return write;
  }

  async syncProfessionalConnection(user: AuthUser, isOnline: boolean) {
    if (user.role !== 'PRESTATAIRE' && user.role !== 'MEDECIN') {
      return null;
    }

    const professional = await this.professionalsRepository.findByUserId(
      user.sub,
    );
    if (!professional) {
      return null;
    }

    if (!isOnline) {
      this.realtimeEvents.emit('user.presence.updated', {
        userId: user.sub,
        professionalId: professional.id,
        isOnline: false,
        changedAt: new Date().toISOString(),
      });
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

    this.realtimeEvents.emit('live-tracking.presence.updated', {
      ...presence,
      userId: user.sub,
    });
    return presence;
  }

  async confirmArrival(
    user: AuthUser,
    reservationId: string,
  ): Promise<ReservationTrackingView> {
    const context =
      await this.liveTrackingRepository.findReservationContext(reservationId);
    if (!context) throw appHttpException('RESERVATIONS_NOT_FOUND');
    if (context.travelMode === 'CLIENT_SE_DEPLACE') {
      if (user.sub !== context.clientUserId)
        throw appHttpException('RESERVATIONS_UNAUTHORIZED');
    } else {
      const professional = await this.requireProfessionalProfile(user);
      if (professional.id !== context.professionalId) {
        throw appHttpException('RESERVATIONS_UNAUTHORIZED');
      }
    }
    const tracking = await this.liveTrackingRepository.confirmArrival({
      reservationId,
      professionalId: context.professionalId,
    });
    if (!tracking)
      throw appHttpException('LIVE_TRACKING_ACTIVE_SESSION_REQUIRED');
    await this.eventBus.publier(
      new ProviderArrivedEvent({
        reservationId,
        clientUserId: context.clientUserId,
        professionalId: context.professionalId,
      }),
    );
    await this.reservationClientNotificationService.notifyReservationArrival({
      reservationId: context.reservationId,
      recipientUserId:
        context.travelMode === 'CLIENT_SE_DEPLACE'
          ? context.professionalUserId
          : context.clientUserId,
      travellerName:
        context.travelMode === 'CLIENT_SE_DEPLACE'
          ? 'Le client'
          : context.professionalName,
      serviceName: context.serviceName,
      travellerRole:
        context.travelMode === 'CLIENT_SE_DEPLACE' ? 'CLIENT' : 'PROFESSIONNEL',
    });
    this.publishLocationRealtime(tracking);
    return tracking;
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
    if (user.role !== 'PRESTATAIRE' && user.role !== 'MEDECIN') {
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

    if (
      dto.latitude !== undefined &&
      dto.longitude !== undefined &&
      !this.isValidCoordinate(dto.latitude, dto.longitude)
    ) {
      throw LiveTrackingDomainError.invalidLocation();
    }
  }

  private enrichTrackingRoute(
    tracking: ReservationTrackingView,
    context: ReservationTrackingContext,
  ): Promise<ReservationTrackingView> {
    return this.routeEstimator.enrich(
      tracking,
      resolveTrackingDestinationAddress(context),
    );
  }

  private assertTelemetry(dto: TrackingLocationCommand): void {
    if (
      dto.accuracyMeters !== undefined &&
      (!Number.isFinite(dto.accuracyMeters) ||
        dto.accuracyMeters < 0 ||
        dto.accuracyMeters > 10_000)
    ) {
      throw LiveTrackingDomainError.invalidLocation();
    }
    if (
      dto.headingDegrees !== undefined &&
      (!Number.isFinite(dto.headingDegrees) ||
        dto.headingDegrees < 0 ||
        dto.headingDegrees > 360)
    ) {
      throw LiveTrackingDomainError.invalidLocation();
    }
    if (
      dto.speedKmh !== undefined &&
      (!Number.isFinite(dto.speedKmh) || dto.speedKmh < 0 || dto.speedKmh > 300)
    ) {
      throw LiveTrackingDomainError.invalidLocation();
    }
  }

  private resolveRecordedAt(dto: TrackingLocationCommand): Date {
    if (!dto.recordedAt) return new Date();
    const timestamp = Date.parse(dto.recordedAt);
    if (!Number.isFinite(timestamp) || timestamp > Date.now() + 60_000) {
      throw LiveTrackingDomainError.invalidLocation();
    }
    return new Date(timestamp);
  }

  private publishTrackingUpdate(
    tracking: ReservationTrackingView,
    context: ReservationTrackingContext,
    dto: TrackingLocationCommand,
    recordedAt: Date,
  ): void {
    this.publishLocationRealtime(tracking);
    void this.enrichAndPublishTrackingRoute(tracking, context, dto, recordedAt);
  }

  private async enrichAndPublishTrackingRoute(
    tracking: ReservationTrackingView,
    context: ReservationTrackingContext,
    dto: TrackingLocationCommand,
    recordedAt: Date,
  ): Promise<void> {
    const enriched = await this.enrichTrackingRoute(tracking, context);
    const latest =
      await this.liveTrackingRepository.findTrackingByReservationId(
        tracking.reservationId,
      );
    if (
      !latest?.lastPositionAt ||
      latest.lastPositionAt.getTime() !== recordedAt.getTime()
    ) {
      return;
    }
    this.publishRouteMetadataRealtime(enriched);
    await this.eventBus.publier(
      new ProviderLocationUpdatedEvent({
        reservationId: tracking.reservationId,
        clientUserId: context.clientUserId,
        professionalId: context.professionalId,
        latitude: dto.latitude ?? tracking.lastLatitude ?? 0,
        longitude: dto.longitude ?? tracking.lastLongitude ?? 0,
        recordedAt: recordedAt.toISOString(),
      }),
    );
  }

  private publishLocationRealtime(tracking: ReservationTrackingView): void {
    if (
      tracking.lastLatitude === null ||
      tracking.lastLongitude === null ||
      !tracking.lastPositionAt
    )
      return;
    this.realtimeEvents.emit('live-tracking.location.updated', {
      reservationId: tracking.reservationId,
      clientUserId: tracking.clientUserId,
      professionalId: tracking.professionalId,
      latitude: tracking.lastLatitude,
      longitude: tracking.lastLongitude,
      accuracyMeters: tracking.lastAccuracyMeters,
      headingDegrees: tracking.lastHeadingDegrees,
      speedKmh: tracking.lastSpeedKmh,
      positionTimestamp: tracking.lastPositionAt.toISOString(),
    });
  }

  private publishRouteMetadataRealtime(
    tracking: ReservationTrackingView,
  ): void {
    if (!tracking.route) return;
    this.realtimeEvents.emit('live-tracking.route-metadata.updated', {
      reservationId: tracking.reservationId,
      clientUserId: tracking.clientUserId,
      professionalId: tracking.professionalId,
      positionTimestamp: tracking.route.positionTimestamp,
      route: tracking.route,
    });
  }

  private isValidCoordinate(lat: number, lng: number): boolean {
    return (
      Number.isFinite(lat) &&
      Number.isFinite(lng) &&
      lat >= -90 &&
      lat <= 90 &&
      lng >= -180 &&
      lng <= 180
    );
  }
}
