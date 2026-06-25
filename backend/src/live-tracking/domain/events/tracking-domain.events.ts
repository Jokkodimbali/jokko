abstract class TrackingDomainEvent<TPayload> {
  readonly dateOccurrence = new Date();

  abstract readonly nom: string;

  constructor(readonly payload: TPayload) {}
}

export class ProviderStartedTripEvent extends TrackingDomainEvent<{
  reservationId: string;
  clientUserId: string;
  professionalId: string;
  startedAt: string;
}> {
  readonly nom = 'tracking.provider.started-trip';
}

export class ProviderLocationUpdatedEvent extends TrackingDomainEvent<{
  reservationId: string;
  clientUserId: string;
  professionalId: string;
  latitude: number;
  longitude: number;
  recordedAt: string;
}> {
  readonly nom = 'tracking.provider.location-updated';
}
