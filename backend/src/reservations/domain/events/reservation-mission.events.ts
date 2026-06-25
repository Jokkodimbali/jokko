type ReservationMissionPayload = {
  reservationId: string;
  clientUserId: string;
  professionalId: string;
};

abstract class ReservationMissionEvent {
  readonly dateOccurrence = new Date();

  abstract readonly nom: string;

  constructor(readonly payload: ReservationMissionPayload) {}
}

export class ProviderAssignedEvent extends ReservationMissionEvent {
  readonly nom = 'tracking.provider.assigned';
}

export class ProviderArrivedEvent extends ReservationMissionEvent {
  readonly nom = 'tracking.provider.arrived';
}

export class ServiceStartedEvent extends ReservationMissionEvent {
  readonly nom = 'tracking.service.started';
}

export class ServiceCompletedEvent extends ReservationMissionEvent {
  readonly nom = 'tracking.service.completed';
}
