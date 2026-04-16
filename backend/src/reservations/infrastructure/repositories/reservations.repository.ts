import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  Reservation,
  ReservationStatus,
} from '../../domain/entities/reservation.entity';
import { ReservationsRepositoryPort } from '../../application/ports/reservations-repository.port';
import { $Enums, Prisma } from '@prisma/client';

@Injectable()
export class ReservationsRepository implements ReservationsRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<Reservation | null> {
    const reservation = await this.prisma.reservation.findUnique({
      where: { id },
    });
    if (!reservation) return null;
    return this.mapToDomain(reservation);
  }

  async findByClient(clientId: string): Promise<Reservation[]> {
    const reservations = await this.prisma.reservation.findMany({
      where: { clientId },
      orderBy: { dateHeure: 'desc' },
    });
    return reservations.map((element) => this.mapToDomain(element));
  }

  async findByProfessional(professionalId: string): Promise<Reservation[]> {
    const reservations = await this.prisma.reservation.findMany({
      where: { professionnelId: professionalId },
      orderBy: { dateHeure: 'desc' },
    });
    return reservations.map((element) => this.mapToDomain(element));
  }

  async findByProfessionalAndDateRange(
    professionalId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<Reservation[]> {
    const reservations = await this.prisma.reservation.findMany({
      where: {
        professionnelId: professionalId,
        dateHeure: {
          gte: startDate,
          lte: endDate,
        },
      },
      orderBy: { dateHeure: 'asc' },
    });
    return reservations.map((element) => this.mapToDomain(element));
  }

  async findByService(serviceId: string): Promise<Reservation[]> {
    const reservations = await this.prisma.reservation.findMany({
      where: { serviceId },
      orderBy: { dateHeure: 'desc' },
    });
    return reservations.map((element) => this.mapToDomain(element));
  }

  async save(reservation: Reservation): Promise<Reservation> {
    const created = await this.prisma.reservation.create({
      data: {
        id: reservation.id,
        clientId: reservation.clientId,
        professionnelId: reservation.professionnelId,
        serviceId: reservation.serviceId,
        dateHeure: reservation.dateHeure,
        dureeMinutes: reservation.dureeMinutes,
        statut: reservation.statut,
        notes: reservation.notes,
        raisonAnnulation: reservation.raisonAnnulation,
        creeLe: reservation.creeLe,
        misAJourLe: reservation.misAJourLe,
      },
    });
    return this.mapToDomain(created);
  }

  async update(reservation: Reservation): Promise<Reservation> {
    const updated = await this.prisma.reservation.update({
      where: { id: reservation.id },
      data: {
        dateHeure: reservation.dateHeure,
        dureeMinutes: reservation.dureeMinutes,
        statut: reservation.statut,
        notes: reservation.notes,
        raisonAnnulation: reservation.raisonAnnulation,
        misAJourLe: new Date(),
      },
    });
    return this.mapToDomain(updated);
  }

  async delete(id: string): Promise<void> {
    await this.prisma.reservation.delete({
      where: { id },
    });
  }

  async existsForTimeSlot(
    professionalId: string,
    dateHeure: Date,
    excludeReservationId?: string,
  ): Promise<boolean> {
    const startOfSlot = new Date(dateHeure);
    startOfSlot.setMinutes(startOfSlot.getMinutes() - 120);
    const endOfSlot = new Date(dateHeure);
    endOfSlot.setMinutes(endOfSlot.getMinutes() + 120);

    const where: Prisma.ReservationWhereInput = {
      professionnelId: professionalId,
      dateHeure: {
        gte: startOfSlot,
        lte: endOfSlot,
      },
      statut: {
        notIn: [
          $Enums.StatutReservation.ANNULEE,
          $Enums.StatutReservation.TERMINEE,
          $Enums.StatutReservation.NO_SHOW,
        ],
      },
    };

    if (excludeReservationId) {
      where.id = { not: excludeReservationId };
    }

    const count = await this.prisma.reservation.count({ where });
    return count > 0;
  }

  async findAllByDateRange(
    startDate: Date,
    endDate: Date,
  ): Promise<Reservation[]> {
    const reservations = await this.prisma.reservation.findMany({
      where: {
        dateHeure: {
          gte: startDate,
          lte: endDate,
        },
      },
      orderBy: { dateHeure: 'asc' },
    });
    return reservations.map((element) => this.mapToDomain(element));
  }

  private mapToDomain(
    this: void,
    reservation: {
      id: string;
      clientId: string;
      professionnelId: string;
      serviceId: string;
      dateHeure: Date;
      dureeMinutes: number;
      statut: $Enums.StatutReservation;
      notes: string | null;
      raisonAnnulation: string | null;
      creeLe: Date;
      misAJourLe: Date;
    },
  ): Reservation {
    return {
      id: reservation.id,
      clientId: reservation.clientId,
      professionnelId: reservation.professionnelId,
      serviceId: reservation.serviceId,
      dateHeure: reservation.dateHeure,
      dureeMinutes: reservation.dureeMinutes,
      statut: reservation.statut as ReservationStatus,
      notes: reservation.notes,
      raisonAnnulation: reservation.raisonAnnulation,
      creeLe: reservation.creeLe,
      misAJourLe: reservation.misAJourLe,
    };
  }
}
