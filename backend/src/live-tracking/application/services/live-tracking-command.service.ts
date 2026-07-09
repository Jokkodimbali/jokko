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
import {
  ProviderArrivedEvent,
  ServiceStartedEvent,
} from '../../../reservations/domain/events/reservation-mission.events';
import {
  LIVE_TRACKING_REPOSITORY_PORT,
  type ReservationTrackingContext,
  type ReservationTrackingView,
  type LiveTrackingRepositoryPort,
} from '../ports/live-tracking-repository.port';
import type { TrackingLocationCommand } from '../commands/tracking-location.command';
import { TrackingRouteEstimatorService } from './tracking-route-estimator.service';
import { resolveTrackingDestinationAddress } from './tracking-parcel-destination.helper';

const SENEGAL_GEO_BOUNDS = {
  minLat: 12,
  maxLat: 17.2,
  minLng: -18.7,
  maxLng: -11,
} as const;
const ARRIVAL_DISTANCE_THRESHOLD_METERS = 120;

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

    await this.eventBus.publier(
      new ProviderStartedTripEvent({
        reservationId: tracking.reservationId,
        clientUserId: tracking.clientUserId,
        professionalId: tracking.professionalId,
        startedAt:
          tracking.startedAt?.toISOString() ?? new Date().toISOString(),
      }),
    );

    let enrichedTracking = await this.enrichTrackingRoute(tracking, context);
    enrichedTracking =
      (await this.startReservationAutomaticallyIfArrived(
        context,
        enrichedTracking,
      )) ?? enrichedTracking;
    this.realtimeEvents.emit(
      'live-tracking.location.updated',
      enrichedTracking,
    );
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

    let tracking = await this.liveTrackingRepository.recordTrackingLocation({
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
      tracking = await this.resumeParcelProviderTrackingFromLocation(
        context,
        professional.id,
        dto,
      );
    }

    if (!tracking) {
      throw appHttpException('LIVE_TRACKING_ACTIVE_SESSION_REQUIRED');
    }

    let enrichedTracking = await this.enrichTrackingRoute(tracking, context);
    enrichedTracking =
      (await this.startReservationAutomaticallyIfArrived(
        context,
        enrichedTracking,
      )) ?? enrichedTracking;
    await this.eventBus.publier(
      new ProviderLocationUpdatedEvent({
        reservationId,
        clientUserId: context.clientUserId,
        professionalId: professional.id,
        latitude: dto.latitude,
        longitude: dto.longitude,
        recordedAt: new Date().toISOString(),
      }),
    );

    this.realtimeEvents.emit(
      'live-tracking.location.updated',
      enrichedTracking,
    );
    this.realtimeEvents.emit(
      'live-tracking.presence.updated',
      tracking.presence,
    );

    return enrichedTracking;
  }

  private async resumeParcelProviderTrackingFromLocation(
    context: ReservationTrackingContext,
    professionalId: string,
    dto: TrackingLocationCommand,
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
    if (user.sub !== context.clientUserId || user.role !== 'CLIENT') {
      throw appHttpException('RESERVATIONS_UNAUTHORIZED');
    }

    if (context.reservationStatus !== 'PAYEE_SEQUESTRE') {
      throw appHttpException('LIVE_TRACKING_INVALID_RESERVATION_STATUS');
    }

    this.assertLocationPair(dto);
    this.assertTelemetry(dto);

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
    });

    const tracking =
      await this.liveTrackingRepository.startOrResumeTravelerTracking({
        session: session.toView(),
      });
    let enrichedTracking = await this.enrichTrackingRoute(tracking, context);
    enrichedTracking =
      (await this.startReservationAutomaticallyIfArrived(
        context,
        enrichedTracking,
      )) ?? enrichedTracking;

    this.realtimeEvents.emit(
      'live-tracking.location.updated',
      enrichedTracking,
    );

    return enrichedTracking;
  }

  private async updateClientLocation(
    user: AuthUser,
    context: ReservationTrackingContext,
    dto: TrackingLocationCommand,
  ) {
    if (user.sub !== context.clientUserId || user.role !== 'CLIENT') {
      throw appHttpException('RESERVATIONS_UNAUTHORIZED');
    }

    this.assertLocationPair(dto);
    this.assertTelemetry(dto);
    if (dto.latitude === undefined || dto.longitude === undefined) {
      throw LiveTrackingDomainError.invalidLocation();
    }

    const tracking =
      await this.liveTrackingRepository.recordTravelerTrackingLocation({
        reservationId: context.reservationId,
        professionalId: context.professionalId,
        latitude: dto.latitude,
        longitude: dto.longitude,
        accuracyMeters: dto.accuracyMeters ?? null,
        headingDegrees: dto.headingDegrees ?? null,
        speedKmh: dto.speedKmh ?? null,
        locationLabel: dto.locationLabel?.trim() ?? 'Position GPS du client',
      });

    if (!tracking) {
      throw appHttpException('LIVE_TRACKING_ACTIVE_SESSION_REQUIRED');
    }

    let enrichedTracking = await this.enrichTrackingRoute(tracking, context);
    enrichedTracking =
      (await this.startReservationAutomaticallyIfArrived(
        context,
        enrichedTracking,
      )) ?? enrichedTracking;
    this.realtimeEvents.emit(
      'live-tracking.location.updated',
      enrichedTracking,
    );

    return enrichedTracking;
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
      !this.isCoordinateInSenegal(dto.latitude, dto.longitude)
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

  private async startReservationAutomaticallyIfArrived(
    context: ReservationTrackingContext,
    tracking: ReservationTrackingView,
  ): Promise<ReservationTrackingView | null> {
    if (
      context.travelMode === 'CLIENT_SE_DEPLACE' ||
      context.travelMode === 'TRANSPORT_COLIS' ||
      context.reservationStatus !== 'PAYEE_SEQUESTRE' ||
      tracking.trackingStatus !== 'EN_ROUTE' ||
      !tracking.route ||
      tracking.route.distanceRemainingMeters > ARRIVAL_DISTANCE_THRESHOLD_METERS
    ) {
      return null;
    }

    const started =
      await this.liveTrackingRepository.startReservationFromArrival({
        reservationId: context.reservationId,
        professionalId: context.professionalId,
      });

    if (!started) {
      return null;
    }

    await this.eventBus.publier(
      new ProviderArrivedEvent({
        reservationId: context.reservationId,
        clientUserId: context.clientUserId,
        professionalId: context.professionalId,
      }),
    );
    await this.eventBus.publier(
      new ServiceStartedEvent({
        reservationId: context.reservationId,
        clientUserId: context.clientUserId,
        professionalId: context.professionalId,
      }),
    );

    this.realtimeEvents.emit(
      'live-tracking.presence.updated',
      started.presence,
    );
    return started;
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

  private isCoordinateInSenegal(lat: number, lng: number): boolean {
    return (
      Number.isFinite(lat) &&
      Number.isFinite(lng) &&
      lat >= SENEGAL_GEO_BOUNDS.minLat &&
      lat <= SENEGAL_GEO_BOUNDS.maxLat &&
      lng >= SENEGAL_GEO_BOUNDS.minLng &&
      lng <= SENEGAL_GEO_BOUNDS.maxLng
    );
  }
}
