export type ProfessionalPresenceStatus =
  | 'HORS_LIGNE'
  | 'EN_LIGNE'
  | 'EN_ROUTE'
  | 'EN_PRESTATION';

export type ProfessionalPresence = {
  professionalId: string;
  isOnline: boolean;
  status: ProfessionalPresenceStatus;
  lastLatitude: number | null;
  lastLongitude: number | null;
  lastAccuracyMeters: number | null;
  lastHeadingDegrees: number | null;
  lastSpeedKmh: number | null;
  lastLocationLabel: string | null;
  lastPositionAt: Date | null;
  lastSeenAt: Date | null;
  updatedAt: Date;
};

export class ProfessionalPresenceEntity {
  private constructor(private readonly state: ProfessionalPresence) {}

  static create(professionalId: string): ProfessionalPresenceEntity {
    return new ProfessionalPresenceEntity({
      professionalId,
      isOnline: false,
      status: 'HORS_LIGNE',
      lastLatitude: null,
      lastLongitude: null,
      lastAccuracyMeters: null,
      lastHeadingDegrees: null,
      lastSpeedKmh: null,
      lastLocationLabel: null,
      lastPositionAt: null,
      lastSeenAt: null,
      updatedAt: new Date(),
    });
  }

  static reconstitute(state: ProfessionalPresence): ProfessionalPresenceEntity {
    return new ProfessionalPresenceEntity({
      ...state,
      lastPositionAt: state.lastPositionAt
        ? new Date(state.lastPositionAt)
        : null,
      lastSeenAt: state.lastSeenAt ? new Date(state.lastSeenAt) : null,
      updatedAt: new Date(state.updatedAt),
    });
  }

  markOnline(): void {
    this.state.isOnline = true;
    if (this.state.status === 'HORS_LIGNE') {
      this.state.status = 'EN_LIGNE';
    }
    this.state.lastSeenAt = new Date();
    this.touch();
  }

  markOffline(): void {
    this.state.isOnline = false;
    if (this.state.status === 'EN_LIGNE') {
      this.state.status = 'HORS_LIGNE';
    }
    this.state.lastSeenAt = new Date();
    this.touch();
  }

  markOnTheWay(): void {
    this.state.isOnline = true;
    this.state.status = 'EN_ROUTE';
    this.state.lastSeenAt = new Date();
    this.touch();
  }

  markInService(): void {
    this.state.status = 'EN_PRESTATION';
    this.state.lastSeenAt = new Date();
    this.touch();
  }

  markAvailable(): void {
    this.state.status = this.state.isOnline ? 'EN_LIGNE' : 'HORS_LIGNE';
    this.state.lastSeenAt = new Date();
    this.touch();
  }

  updateLocation(input: {
    latitude: number;
    longitude: number;
    accuracyMeters?: number | null;
    headingDegrees?: number | null;
    speedKmh?: number | null;
    locationLabel?: string | null;
  }): void {
    this.state.lastLatitude = input.latitude;
    this.state.lastLongitude = input.longitude;
    this.state.lastAccuracyMeters = input.accuracyMeters ?? null;
    this.state.lastHeadingDegrees = input.headingDegrees ?? null;
    this.state.lastSpeedKmh = input.speedKmh ?? null;
    this.state.lastLocationLabel = input.locationLabel ?? null;
    this.state.lastPositionAt = new Date();
    this.state.lastSeenAt = new Date();
    this.touch();
  }

  toView(): ProfessionalPresence {
    return {
      ...this.state,
      lastPositionAt: this.state.lastPositionAt
        ? new Date(this.state.lastPositionAt)
        : null,
      lastSeenAt: this.state.lastSeenAt
        ? new Date(this.state.lastSeenAt)
        : null,
      updatedAt: new Date(this.state.updatedAt),
    };
  }

  private touch(): void {
    this.state.updatedAt = new Date();
  }
}
