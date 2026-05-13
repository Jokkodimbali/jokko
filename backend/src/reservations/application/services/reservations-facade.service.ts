import { Injectable } from '@nestjs/common';
import type { AuthUser } from '../../../auth/security/auth-user.type';
import type {
  CancelReservationCommand,
  CreateReservationCommand,
  CreateReservationFromNegotiationCommand,
  ListReservationsQuery,
  ProposeReservationPriceAdjustmentCommand,
  RescheduleReservationCommand,
  SubmitReservationReviewCommand,
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

  async checkAvailability(query: {
    professionalId: string;
    dateHeure: string;
    dureeMinutes: number;
  }) {
    return this.reservationQueryService.checkAvailability(query);
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

  async getReservationStatistics(
    requestUser: AuthUser,
    query: ListReservationsQuery,
  ) {
    return this.reservationQueryService.getReservationStatistics(
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

  async proposePriceAdjustment(
    requestUser: AuthUser,
    reservationId: string,
    command: ProposeReservationPriceAdjustmentCommand,
  ) {
    return this.reservationCommandService.proposePriceAdjustment(
      requestUser,
      reservationId,
      command,
    );
  }

  async acceptPriceAdjustment(requestUser: AuthUser, reservationId: string) {
    return this.reservationCommandService.acceptPriceAdjustment(
      requestUser,
      reservationId,
    );
  }

  async rejectPriceAdjustment(requestUser: AuthUser, reservationId: string) {
    return this.reservationCommandService.rejectPriceAdjustment(
      requestUser,
      reservationId,
    );
  }

  async completeReservation(requestUser: AuthUser, reservationId: string) {
    return this.reservationCommandService.completeReservation(
      requestUser,
      reservationId,
    );
  }

  async submitReview(
    requestUser: AuthUser,
    reservationId: string,
    command: SubmitReservationReviewCommand,
  ) {
    return this.reservationCommandService.submitReview(
      requestUser,
      reservationId,
      command,
    );
  }

  async markNoShow(requestUser: AuthUser, reservationId: string) {
    return this.reservationCommandService.markNoShow(
      requestUser,
      reservationId,
    );
  }

  async markAsPaid(requestUser: AuthUser, reservationId: string) {
    return this.reservationCommandService.markAsPaid(
      requestUser,
      reservationId,
    );
  }

  async startReservation(requestUser: AuthUser, reservationId: string) {
    return this.reservationCommandService.startReservation(
      requestUser,
      reservationId,
    );
  }

  async openDispute(
    requestUser: AuthUser,
    reservationId: string,
    reason: string,
  ) {
    return this.reservationCommandService.openDispute(
      requestUser,
      reservationId,
      reason,
    );
  }
}
