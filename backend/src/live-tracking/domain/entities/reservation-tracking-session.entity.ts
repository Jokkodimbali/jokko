import { LiveTrackingDomainError } from '../errors/live-tracking.domain-error';

export type ReservationTrackingStatus = 'EN_ROUTE' | 'TERMINEE' | 'ANNULEE';

export type ReservationTrackingSession = {
  reservationId: string;
  clientUserId: string;
  professionalId: string;
  professionalUserId: string;
  trackingStatus: ReservationTrackingStatus | 'INACTIF';
  startedAt: Date | null;
  endedAt: Date | null;
  lastLatitude: number | null;
  lastLongitude: number | null;
  lastAccuracyMeters: number | null;
  lastHeadingDegrees: number | null;
  lastSpeedKmh: number | null;
  lastLocationLabel: string | null;
  lastPositionAt: Date | null;
  updatedAt: Date | null;
};

export class ReservationTrackingSessionEntity {
  private constructor(private readonly state: ReservationTrackingSession) {}

  static start(input: {
    reservationId: string;
    clientUserId: string;
    professionalId: string;
    professionalUserId: string;
    latitude?: number | null;
    longitude?: number | null;
    accuracyMeters?: number | null;
    headingDegrees?: number | null;
    speedKmh?: number | null;
    locationLabel?: string | null;
    recordedAt?: Date;
  }): ReservationTrackingSessionEntity {
    const now = new Date();
    const lastPositionAt = input.recordedAt ?? now;
    const hasCoordinates =
      input.latitude !== null &&
      input.latitude !== undefined &&
      input.longitude !== null &&
      input.longitude !== undefined;
    return new ReservationTrackingSessionEntity({
      reservationId: input.reservationId,
      clientUserId: input.clientUserId,
      professionalId: input.professionalId,
      professionalUserId: input.professionalUserId,
      trackingStatus: 'EN_ROUTE',
      startedAt: now,
      endedAt: null,
      lastLatitude: input.latitude ?? null,
      lastLongitude: input.longitude ?? null,
      lastAccuracyMeters: input.accuracyMeters ?? null,
      lastHeadingDegrees: input.headingDegrees ?? null,
      lastSpeedKmh: input.speedKmh ?? null,
      lastLocationLabel: input.locationLabel ?? null,
      lastPositionAt: hasCoordinates ? lastPositionAt : null,
      updatedAt: now,
    });
  }

  static reconstitute(
    state: ReservationTrackingSession,
  ): ReservationTrackingSessionEntity {
    return new ReservationTrackingSessionEntity({
      ...state,
      startedAt: state.startedAt ? new Date(state.startedAt) : null,
      endedAt: state.endedAt ? new Date(state.endedAt) : null,
      lastPositionAt: state.lastPositionAt
        ? new Date(state.lastPositionAt)
        : null,
      updatedAt: state.updatedAt ? new Date(state.updatedAt) : null,
    });
  }

  recordLocation(input: {
    latitude: number;
    longitude: number;
    accuracyMeters?: number | null;
    headingDegrees?: number | null;
    speedKmh?: number | null;
    locationLabel?: string | null;
  }): void {
    if (this.state.trackingStatus !== 'EN_ROUTE') {
      throw LiveTrackingDomainError.activeSessionRequired();
    }

    this.state.lastLatitude = input.latitude;
    this.state.lastLongitude = input.longitude;
    this.state.lastAccuracyMeters = input.accuracyMeters ?? null;
    this.state.lastHeadingDegrees = input.headingDegrees ?? null;
    this.state.lastSpeedKmh = input.speedKmh ?? null;
    this.state.lastLocationLabel = input.locationLabel ?? null;
    this.state.lastPositionAt = new Date();
    this.touch();
  }

  complete(status: 'TERMINEE' | 'ANNULEE'): void {
    if (this.state.trackingStatus !== 'EN_ROUTE') {
      return;
    }

    this.state.trackingStatus = status;
    this.state.endedAt = new Date();
    this.touch();
  }

  toView(): ReservationTrackingSession {
    return {
      ...this.state,
      startedAt: this.state.startedAt ? new Date(this.state.startedAt) : null,
      endedAt: this.state.endedAt ? new Date(this.state.endedAt) : null,
      lastPositionAt: this.state.lastPositionAt
        ? new Date(this.state.lastPositionAt)
        : null,
      updatedAt: this.state.updatedAt ? new Date(this.state.updatedAt) : null,
    };
  }

  private touch(): void {
    this.state.updatedAt = new Date();
  }
}
