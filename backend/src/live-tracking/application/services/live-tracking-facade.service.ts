import { Injectable } from '@nestjs/common';
import type { AuthUser } from '../../../auth/security/auth-user.type';
import type { TrackingLocationCommand } from '../commands/tracking-location.command';
import { LiveTrackingCommandService } from './live-tracking-command.service';
import { LiveTrackingQueryService } from './live-tracking-query.service';

@Injectable()
export class LiveTrackingFacade {
  constructor(
    private readonly commandService: LiveTrackingCommandService,
    private readonly queryService: LiveTrackingQueryService,
  ) {}

  markOnTheWay(
    user: AuthUser,
    reservationId: string,
    dto: TrackingLocationCommand,
  ) {
    return this.commandService.markOnTheWay(user, reservationId, dto);
  }

  updateLocation(
    user: AuthUser,
    reservationId: string,
    dto: TrackingLocationCommand,
  ) {
    return this.commandService.updateLocation(user, reservationId, dto);
  }

  syncProfessionalConnection(user: AuthUser, isOnline: boolean) {
    return this.commandService.syncProfessionalConnection(user, isOnline);
  }

  finalizeReservationTracking(input: {
    reservationId: string;
    professionalId: string;
    trackingStatus: 'TERMINEE' | 'ANNULEE';
    nextPresenceStatus: 'EN_LIGNE' | 'EN_PRESTATION' | 'HORS_LIGNE';
  }) {
    return this.commandService.finalizeReservationTracking(input);
  }

  getReservationTracking(user: AuthUser, reservationId: string) {
    return this.queryService.getReservationTracking(user, reservationId);
  }

  getProfessionalPresence(professionalId: string) {
    return this.queryService.getProfessionalPresence(professionalId);
  }
}
