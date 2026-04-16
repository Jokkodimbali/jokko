/* eslint-disable no-duplicate-imports */
import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  ReservationEntity,
  type Reservation,
} from '../../domain/entities/reservation.entity';
import { ReservationDomainError } from '../../domain/errors/reservation.domain-error';
import type { ReservationsRepositoryPort } from '../ports/reservations-repository.port';
import { RESERVATIONS_REPOSITORY_PORT } from '../ports/reservations-repository.port';
import {
  PROFESSIONALS_REPOSITORY_PORT,
  type ProfessionalsRepositoryPort,
} from '../../../professionals/application/ports/professionals-repository.port';

export interface CreateReservationDto {
  clientId: string;
  professionnelId: string;
  serviceId: string;
  dateHeure: Date;
  dureeMinutes: number;
  notes?: string;
}

export interface CreateReservationFromNegotiationDto {
  negotiationId: string;
  userId: string;
  dateHeure: Date;
  dureeMinutes: number;
  notes?: string;
}

export interface UpdateReservationDto {
  reservationId: string;
  userId: string;
  isProfessional: boolean;
}

@Injectable()
export class ReservationsFacade {
  constructor(
    @Inject(RESERVATIONS_REPOSITORY_PORT)
    private readonly reservationsRepo: ReservationsRepositoryPort,
    @Inject(PROFESSIONALS_REPOSITORY_PORT)
    private readonly professionalsRepo: ProfessionalsRepositoryPort,
  ) {}

  async createReservation(
    dto: CreateReservationDto,
  ): Promise<Reservation | { requiresNegotiation: true; serviceId: string }> {
    // Check if service is negotiable
    const service = await this.professionalsRepo.getServiceById(dto.serviceId);
    if (!service) {
      throw ReservationDomainError.serviceRequired();
    }

    if (service.typePrix === 'NEGOCIABLE') {
      // For negotiable services, return indication that negotiation is required
      return { requiresNegotiation: true, serviceId: dto.serviceId };
    }

    // For fixed price services, proceed with reservation creation
    const exists = await this.reservationsRepo.existsForTimeSlot(
      dto.professionnelId,
      dto.dateHeure,
    );
    if (exists) {
      throw ReservationDomainError.timeSlotUnavailable();
    }

    const reservation = ReservationEntity.create(
      randomUUID(),
      dto.clientId,
      dto.professionnelId,
      dto.serviceId,
      dto.dateHeure,
      dto.dureeMinutes,
      dto.notes || null,
    );

    const saved = await this.reservationsRepo.save(reservation.toView());
    return saved;
  }

  createReservationFromNegotiation(
    dto: CreateReservationFromNegotiationDto,
  ): Promise<Reservation> {
    throw ReservationDomainError.timeSlotUnavailable();
  }

  async getReservationById(id: string): Promise<Reservation> {
    const reservation = await this.reservationsRepo.findById(id);
    if (!reservation) {
      throw ReservationDomainError.notFound();
    }
    return reservation;
  }

  async getClientReservations(clientId: string): Promise<Reservation[]> {
    return this.reservationsRepo.findByClient(clientId);
  }

  async getProfessionalReservations(
    professionalId: string,
  ): Promise<Reservation[]> {
    return this.reservationsRepo.findByProfessional(professionalId);
  }

  async getProfessionalReservationsByDateRange(
    professionalId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<Reservation[]> {
    return this.reservationsRepo.findByProfessionalAndDateRange(
      professionalId,
      startDate,
      endDate,
    );
  }

  async getAllReservationsByDateRange(
    startDate: Date,
    endDate: Date,
  ): Promise<Reservation[]> {
    return this.reservationsRepo.findAllByDateRange(startDate, endDate);
  }

  async confirmReservation(
    reservationId: string,
    userId: string,
    isProfessional: boolean,
  ): Promise<Reservation> {
    const reservation = await this.reservationsRepo.findById(reservationId);
    if (!reservation) {
      throw ReservationDomainError.notFound();
    }

    if (isProfessional && reservation.professionnelId !== userId) {
      throw ReservationDomainError.unauthorized();
    }
    if (!isProfessional && reservation.clientId !== userId) {
      throw ReservationDomainError.unauthorized();
    }

    const entity = ReservationEntity.reconstitute(reservation);
    entity.confirm();

    const updated = await this.reservationsRepo.update(entity.toView());
    return updated;
  }

  async cancelReservation(
    reservationId: string,
    userId: string,
    isProfessional: boolean,
    reason: string,
  ): Promise<Reservation> {
    const reservation = await this.reservationsRepo.findById(reservationId);
    if (!reservation) {
      throw ReservationDomainError.notFound();
    }

    if (isProfessional && reservation.professionnelId !== userId) {
      throw ReservationDomainError.unauthorized();
    }
    if (!isProfessional && reservation.clientId !== userId) {
      throw ReservationDomainError.unauthorized();
    }

    const entity = ReservationEntity.reconstitute(reservation);
    entity.cancel(reason);

    const updated = await this.reservationsRepo.update(entity.toView());
    return updated;
  }

  async completeReservation(
    reservationId: string,
    professionalId: string,
  ): Promise<Reservation> {
    const reservation = await this.reservationsRepo.findById(reservationId);
    if (!reservation) {
      throw ReservationDomainError.notFound();
    }

    if (reservation.professionnelId !== professionalId) {
      throw ReservationDomainError.unauthorized();
    }

    const entity = ReservationEntity.reconstitute(reservation);
    entity.markAsCompleted();

    const updated = await this.reservationsRepo.update(entity.toView());
    return updated;
  }

  async markNoShow(
    reservationId: string,
    professionalId: string,
  ): Promise<Reservation> {
    const reservation = await this.reservationsRepo.findById(reservationId);
    if (!reservation) {
      throw ReservationDomainError.notFound();
    }

    if (reservation.professionnelId !== professionalId) {
      throw ReservationDomainError.unauthorized();
    }

    const entity = ReservationEntity.reconstitute(reservation);
    entity.markAsNoShow();

    const updated = await this.reservationsRepo.update(entity.toView());
    return updated;
  }

  async rescheduleReservation(
    reservationId: string,
    userId: string,
    isProfessional: boolean,
    newDateTime: Date,
  ): Promise<Reservation> {
    const reservation = await this.reservationsRepo.findById(reservationId);
    if (!reservation) {
      throw ReservationDomainError.notFound();
    }

    if (isProfessional && reservation.professionnelId !== userId) {
      throw ReservationDomainError.unauthorized();
    }
    if (!isProfessional && reservation.clientId !== userId) {
      throw ReservationDomainError.unauthorized();
    }

    const exists = await this.reservationsRepo.existsForTimeSlot(
      reservation.professionnelId,
      newDateTime,
      reservationId,
    );
    if (exists) {
      throw ReservationDomainError.timeSlotUnavailable();
    }

    const entity = ReservationEntity.reconstitute(reservation);
    entity.reschedule(newDateTime);

    const updated = await this.reservationsRepo.update(entity.toView());
    return updated;
  }
}
