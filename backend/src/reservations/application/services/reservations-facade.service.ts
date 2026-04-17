import { Injectable } from '@nestjs/common';
import type { AuthUser } from '../../../auth/security/auth-user.type';
import type {
  CancelReservationCommand,
  CreateReservationCommand,
  CreateReservationFromNegotiationCommand,
  ListReservationsQuery,
  RescheduleReservationCommand,
} from '../commands/reservations.commands';
import { ReservationCommandService } from './reservation-command.service';
import { ReservationQueryService } from './reservation-query.service';

@Injectable()
export class ReservationsFacade {
  constructor(
    private readonly reservationCommandService: ReservationCommandService,
    private readonly reservationQueryService: ReservationQueryService,
  ) {}

  async createReservation(
    requestUser: AuthUser,
    command: CreateReservationCommand,
  ) {
    return this.reservationCommandService.createReservation(
      requestUser,
      command,
    );
  }

  async createReservationFromNegotiation(
    requestUser: AuthUser,
    command: CreateReservationFromNegotiationCommand,
  ) {
    return this.reservationCommandService.createReservationFromNegotiation(
      requestUser,
      command,
    );
  }

  async getMyReservations(requestUser: AuthUser, query: ListReservationsQuery) {
    return this.reservationQueryService.getMyReservations(requestUser, query);
  }

  async getReservationById(requestUser: AuthUser, reservationId: string) {
    return this.reservationQueryService.getReservationById(
      requestUser,
      reservationId,
    );
  }

  async getAllReservationsByDateRange(
    requestUser: AuthUser,
    query: ListReservationsQuery,
  ) {
    return this.reservationQueryService.getAllReservationsByDateRange(
      requestUser,
      query,
    );
  }

  async confirmReservation(requestUser: AuthUser, reservationId: string) {
    return this.reservationCommandService.confirmReservation(
      requestUser,
      reservationId,
    );
  }

  async cancelReservation(
    requestUser: AuthUser,
    reservationId: string,
    command: CancelReservationCommand,
  ) {
    return this.reservationCommandService.cancelReservation(
      requestUser,
      reservationId,
      command,
    );
  }

  async rescheduleReservation(
    requestUser: AuthUser,
    reservationId: string,
    command: RescheduleReservationCommand,
  ) {
    return this.reservationCommandService.rescheduleReservation(
      requestUser,
      reservationId,
      command,
    );
  }

  async completeReservation(requestUser: AuthUser, reservationId: string) {
    return this.reservationCommandService.completeReservation(
      requestUser,
      reservationId,
    );
  }

  async markNoShow(requestUser: AuthUser, reservationId: string) {
    return this.reservationCommandService.markNoShow(
      requestUser,
      reservationId,
    );
  }
}
