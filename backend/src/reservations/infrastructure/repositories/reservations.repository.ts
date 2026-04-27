import { Injectable } from '@nestjs/common';
import { $Enums, Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import type { ReservationsRepositoryPort } from '../../application/ports/reservations-repository.port';
import type {
  Reservation,
  ReservationStatus,
} from '../../domain/entities/reservation.entity';
import { ReservationDomainError } from '../../domain/errors/reservation.domain-error';

const RESERVATION_SELECT = {
  id: true,
  clientId: true,
  professionnelId: true,
  serviceId: true,
  dateHeure: true,
  adresseClient: true,
  dureeMinutes: true,
  statut: true,
  notes: true,
  prixConvenu: true,
  raisonAnnulation: true,
  creeLe: true,
  misAJourLe: true,
} as const;

type ReservationRecord = {
  id: string;
  clientId: string;
  professionnelId: string;
  serviceId: string;
  dateHeure: Date;
  adresseClient: string;
  dureeMinutes: number;
  statut: $Enums.StatutReservation;
  notes: string | null;
  prixConvenu: Prisma.Decimal | null;
  raisonAnnulation: string | null;
  creeLe: Date;
  misAJourLe: Date;
};

@Injectable()
export class ReservationsRepository implements ReservationsRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string): Promise<Reservation | null> {
    const reservation = await this.prisma.reservation.findUnique({
      where: { id },
      select: RESERVATION_SELECT,
    });

    return reservation ? this.mapToDomain(reservation) : null;
  }

  async findByClient(clientId: string): Promise<Reservation[]> {
    const reservations = await this.prisma.reservation.findMany({
      where: { clientId },
      orderBy: { dateHeure: 'desc' },
      select: RESERVATION_SELECT,
    });

    return reservations.map((reservation) => this.mapToDomain(reservation));
  }

  async findByClientAndDateRange(
    clientId: string,
    startDate: Date,
    endDate: Date,
  ): Promise<Reservation[]> {
    const reservations = await this.prisma.reservation.findMany({
      where: {
        clientId,
        dateHeure: {
          gte: startDate,
          lte: endDate,
        },
      },
      orderBy: { dateHeure: 'asc' },
      select: RESERVATION_SELECT,
    });

    return reservations.map((reservation) => this.mapToDomain(reservation));
  }

  async findByProfessional(professionalId: string): Promise<Reservation[]> {
    const reservations = await this.prisma.reservation.findMany({
      where: { professionnelId: professionalId },
      orderBy: { dateHeure: 'desc' },
      select: RESERVATION_SELECT,
    });

    return reservations.map((reservation) => this.mapToDomain(reservation));
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
      select: RESERVATION_SELECT,
    });

    return reservations.map((reservation) => this.mapToDomain(reservation));
  }

  async findByService(serviceId: string): Promise<Reservation[]> {
    const reservations = await this.prisma.reservation.findMany({
      where: { serviceId },
      orderBy: { dateHeure: 'desc' },
      select: RESERVATION_SELECT,
    });

    return reservations.map((reservation) => this.mapToDomain(reservation));
  }

  async save(reservation: Reservation): Promise<Reservation> {
    const created = await this.prisma.$transaction(async (tx) => {
      await this.lockProfessionalSchedule(tx, reservation.professionnelId);
      const hasConflict = await this.existsForTimeSlot(tx, {
        professionalId: reservation.professionnelId,
        dateHeure: reservation.dateHeure,
        dureeMinutes: reservation.dureeMinutes,
      });
      if (hasConflict) {
        throw ReservationDomainError.timeSlotUnavailable();
      }

      return tx.reservation.create({
        data: {
          id: reservation.id,
          clientId: reservation.clientId,
          professionnelId: reservation.professionnelId,
          serviceId: reservation.serviceId,
          dateHeure: reservation.dateHeure,
          adresseClient: reservation.adresseClient,
          dureeMinutes: reservation.dureeMinutes,
          statut: reservation.statut,
          notes: reservation.notes,
          prixConvenu: reservation.prixConvenu,
          raisonAnnulation: reservation.raisonAnnulation,
          creeLe: reservation.creeLe,
          misAJourLe: reservation.misAJourLe,
        },
        select: RESERVATION_SELECT,
      });
    });

    return this.mapToDomain(created);
  }

  async update(reservation: Reservation): Promise<Reservation> {
    const updated = await this.prisma.$transaction(async (tx) => {
      await this.lockProfessionalSchedule(tx, reservation.professionnelId);
      const hasConflict = await this.existsForTimeSlot(tx, {
        professionalId: reservation.professionnelId,
        dateHeure: reservation.dateHeure,
        dureeMinutes: reservation.dureeMinutes,
        excludeReservationId: reservation.id,
      });
      if (hasConflict && this.requiresTimeSlot(reservation.statut)) {
        throw ReservationDomainError.timeSlotUnavailable();
      }

      return tx.reservation.update({
        where: { id: reservation.id },
        data: {
          dateHeure: reservation.dateHeure,
          adresseClient: reservation.adresseClient,
          dureeMinutes: reservation.dureeMinutes,
          statut: reservation.statut,
          notes: reservation.notes,
          prixConvenu: reservation.prixConvenu,
          raisonAnnulation: reservation.raisonAnnulation,
          misAJourLe: reservation.misAJourLe,
        },
        select: RESERVATION_SELECT,
      });
    });

    return this.mapToDomain(updated);
  }

  async delete(id: string): Promise<void> {
    await this.prisma.reservation.delete({
      where: { id },
    });
  }

  private async existsForTimeSlot(
    tx: Prisma.TransactionClient,
    input: {
      professionalId: string;
      dateHeure: Date;
      dureeMinutes: number;
      excludeReservationId?: string;
    },
  ): Promise<boolean> {
    const requestedStart = input.dateHeure;
    const requestedEnd = new Date(
      requestedStart.getTime() + input.dureeMinutes * 60 * 1000,
    );
    const searchWindowStart = new Date(
      requestedStart.getTime() - 24 * 60 * 60 * 1000,
    );
    const searchWindowEnd = new Date(
      requestedEnd.getTime() + 24 * 60 * 60 * 1000,
    );

    const where: Prisma.ReservationWhereInput = {
      professionnelId: input.professionalId,
      dateHeure: {
        gte: searchWindowStart,
        lte: searchWindowEnd,
      },
      statut: {
        notIn: [
          $Enums.StatutReservation.ANNULEE,
          $Enums.StatutReservation.TERMINEE,
          $Enums.StatutReservation.NO_SHOW,
        ],
      },
    };

    if (input.excludeReservationId) {
      where.id = { not: input.excludeReservationId };
    }

    const candidates = await tx.reservation.findMany({
      where,
      select: {
        id: true,
        dateHeure: true,
        dureeMinutes: true,
      },
    });

    return candidates.some((candidate) => {
      const candidateStart = candidate.dateHeure;
      const candidateEnd = new Date(
        candidateStart.getTime() + candidate.dureeMinutes * 60 * 1000,
      );

      return candidateStart < requestedEnd && candidateEnd > requestedStart;
    });
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
      select: RESERVATION_SELECT,
    });

    return reservations.map((reservation) => this.mapToDomain(reservation));
  }

  async findByFilters(filters: {
    clientId?: string;
    professionalId?: string;
    serviceId?: string;
    status?: string;
    startDate?: Date;
    endDate?: Date;
  }): Promise<Reservation[]> {
    const where: Prisma.ReservationWhereInput = {};

    if (filters.clientId) {
      where.clientId = filters.clientId;
    }

    if (filters.professionalId) {
      where.professionnelId = filters.professionalId;
    }

    if (filters.serviceId) {
      where.serviceId = filters.serviceId;
    }

    if (filters.status) {
      where.statut = filters.status as $Enums.StatutReservation;
    }

    if (filters.startDate || filters.endDate) {
      where.dateHeure = {};
      if (filters.startDate) {
        where.dateHeure.gte = filters.startDate;
      }
      if (filters.endDate) {
        where.dateHeure.lte = filters.endDate;
      }
    }

    const reservations = await this.prisma.reservation.findMany({
      where,
      orderBy: { dateHeure: 'desc' },
      select: RESERVATION_SELECT,
    });

    return reservations.map((reservation) => this.mapToDomain(reservation));
  }

  private mapToDomain(record: ReservationRecord): Reservation {
    return {
      id: record.id,
      clientId: record.clientId,
      professionnelId: record.professionnelId,
      serviceId: record.serviceId,
      dateHeure: record.dateHeure,
      adresseClient: record.adresseClient,
      dureeMinutes: record.dureeMinutes,
      statut: record.statut as ReservationStatus,
      notes: record.notes,
      prixConvenu: record.prixConvenu?.toNumber() ?? null,
      raisonAnnulation: record.raisonAnnulation,
      creeLe: record.creeLe,
      misAJourLe: record.misAJourLe,
    };
  }

  private async lockProfessionalSchedule(
    tx: Prisma.TransactionClient,
    professionalId: string,
  ): Promise<void> {
    await tx.$executeRaw`
      SELECT pg_advisory_xact_lock(hashtext(${professionalId}), 0)
    `;
  }

  private requiresTimeSlot(status: ReservationStatus): boolean {
    return (
      status === 'EN_ATTENTE' ||
      status === 'CONFIRMEE' ||
      status === 'PAYEE_SEQUESTRE' ||
      status === 'EN_COURS'
    );
  }
}
