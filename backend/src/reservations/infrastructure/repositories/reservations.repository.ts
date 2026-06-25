import { Injectable } from '@nestjs/common';
import { $Enums, Prisma } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import type {
  ReservationDetailedView,
  ReservationsRepositoryPort,
} from '../../application/ports/reservations-repository.port';
import type {
  Reservation,
  ReservationPriceAdjustmentStatus,
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
  statutAjustementPrix: true,
  prixAjustementPropose: true,
  raisonAjustementPrix: true,
  demandeAjustementPrixLe: true,
  raisonAnnulation: true,
  clientRating: true,
  clientReview: true,
  clientReviewedAt: true,
  creeLe: true,
  misAJourLe: true,
} as const;

const RESERVATION_DETAIL_SELECT = {
  ...RESERVATION_SELECT,
  client: {
    select: {
      id: true,
      nom: true,
      numeroTelephone: true,
      email: true,
      adresse: true,
      urlAvatar: true,
    },
  },
  service: {
    select: {
      id: true,
      profilProfessionnelId: true,
      categorieId: true,
      nom: true,
      description: true,
      prix: true,
      typePrix: true,
      modeDeplacement: true,
      dureeMinutes: true,
      estObligatoire: true,
      estDisponible: true,
      categorie: {
        select: {
          id: true,
          nom: true,
          urlIcone: true,
          tauxCommission: true,
        },
      },
    },
  },
  professionnel: {
    select: {
      id: true,
      utilisateurId: true,
      nomEntreprise: true,
      ville: true,
      noteGlobale: true,
      nombreAvis: true,
      utilisateur: {
        select: {
          id: true,
          nom: true,
          numeroTelephone: true,
          urlAvatar: true,
        },
      },
    },
  },
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
  statutAjustementPrix: $Enums.StatutAjustementPrixReservation;
  prixAjustementPropose: Prisma.Decimal | null;
  raisonAjustementPrix: string | null;
  demandeAjustementPrixLe: Date | null;
  raisonAnnulation: string | null;
  clientRating: number | null;
  clientReview: string | null;
  clientReviewedAt: Date | null;
  creeLe: Date;
  misAJourLe: Date;
};

type ReservationDetailRecord = ReservationRecord & {
  client: {
    id: string;
    nom: string;
    numeroTelephone: string;
    email: string | null;
    adresse: string | null;
    urlAvatar: string | null;
  };
  service: {
    id: string;
    profilProfessionnelId: string;
    categorieId: string;
    nom: string;
    description: string;
    prix: Prisma.Decimal;
    typePrix: $Enums.TypePrix;
    modeDeplacement: $Enums.ModeDeplacementService;
    dureeMinutes: number;
    estObligatoire: boolean;
    estDisponible: boolean;
    categorie: {
      id: string;
      nom: string;
      urlIcone: string | null;
      tauxCommission: Prisma.Decimal;
    };
  };
  professionnel: {
    id: string;
    utilisateurId: string;
    nomEntreprise: string | null;
    ville: string | null;
    noteGlobale: Prisma.Decimal;
    nombreAvis: number;
    utilisateur: {
      id: string;
      nom: string;
      numeroTelephone: string;
      urlAvatar: string | null;
    };
  };
};

@Injectable()
export class ReservationsRepository implements ReservationsRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async syncOverdueReservations(now: Date): Promise<number> {
    const candidates = await this.prisma.reservation.findMany({
      where: {
        statut: {
          in: [$Enums.StatutReservation.EN_ATTENTE],
        },
        dateHeure: {
          lt: now,
        },
      },
      select: {
        id: true,
        dateHeure: true,
        dureeMinutes: true,
      },
      take: 500,
    });

    const overdueIds = candidates
      .filter((reservation) => {
        const durationMinutes = Math.max(0, reservation.dureeMinutes || 0);
        const endAt =
          reservation.dateHeure.getTime() + durationMinutes * 60_000;
        return endAt <= now.getTime();
      })
      .map((reservation) => reservation.id);

    if (overdueIds.length === 0) {
      return 0;
    }

    const result = await this.prisma.reservation.updateMany({
      where: {
        id: { in: overdueIds },
        statut: {
          in: [$Enums.StatutReservation.EN_ATTENTE],
        },
      },
      data: {
        statut: $Enums.StatutReservation.NO_SHOW,
        misAJourLe: now,
      },
    });

    return result.count;
  }

  async findById(id: string): Promise<Reservation | null> {
    const reservation = await this.prisma.reservation.findUnique({
      where: { id },
      select: RESERVATION_SELECT,
    });

    return reservation ? this.mapToDomain(reservation) : null;
  }

  async findDetailedById(id: string): Promise<ReservationDetailedView | null> {
    const reservation = await this.prisma.reservation.findUnique({
      where: { id },
      select: RESERVATION_DETAIL_SELECT,
    });

    return reservation ? this.mapToDetailedView(reservation) : null;
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
          statutAjustementPrix: reservation.statutAjustementPrix,
          prixAjustementPropose: reservation.prixAjustementPropose,
          raisonAjustementPrix: reservation.raisonAjustementPrix,
          demandeAjustementPrixLe: reservation.demandeAjustementPrixLe,
          raisonAnnulation: reservation.raisonAnnulation,
          clientRating: reservation.clientRating,
          clientReview: reservation.clientReview,
          clientReviewedAt: reservation.clientReviewedAt,
          creeLe: reservation.creeLe,
          misAJourLe: reservation.misAJourLe,
        },
        select: RESERVATION_SELECT,
      });
    });

    return this.mapToDomain(created);
  }

  async saveFromNegotiation(
    reservation: Reservation,
    negotiationId: string,
  ): Promise<Reservation | null> {
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

      const linkedNegotiation = await tx.negotiation.findUnique({
        where: { id: negotiationId },
        select: {
          id: true,
          statut: true,
          reservationId: true,
        },
      });

      if (
        linkedNegotiation?.statut !== 'ACCEPTEE' ||
        linkedNegotiation.reservationId
      ) {
        return null;
      }

      const createdReservation = await tx.reservation.create({
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
          statutAjustementPrix: reservation.statutAjustementPrix,
          prixAjustementPropose: reservation.prixAjustementPropose,
          raisonAjustementPrix: reservation.raisonAjustementPrix,
          demandeAjustementPrixLe: reservation.demandeAjustementPrixLe,
          raisonAnnulation: reservation.raisonAnnulation,
          clientRating: reservation.clientRating,
          clientReview: reservation.clientReview,
          clientReviewedAt: reservation.clientReviewedAt,
          creeLe: reservation.creeLe,
          misAJourLe: reservation.misAJourLe,
        },
        select: RESERVATION_SELECT,
      });

      await tx.negotiation.update({
        where: { id: negotiationId },
        data: {
          statut: 'CONVERTIE_EN_RESERVATION',
          reservationId: createdReservation.id,
        },
      });

      return createdReservation;
    });

    return created ? this.mapToDomain(created) : null;
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
          statutAjustementPrix: reservation.statutAjustementPrix,
          prixAjustementPropose: reservation.prixAjustementPropose,
          raisonAjustementPrix: reservation.raisonAjustementPrix,
          demandeAjustementPrixLe: reservation.demandeAjustementPrixLe,
          raisonAnnulation: reservation.raisonAnnulation,
          clientRating: reservation.clientRating,
          clientReview: reservation.clientReview,
          clientReviewedAt: reservation.clientReviewedAt,
          misAJourLe: reservation.misAJourLe,
        },
        select: RESERVATION_SELECT,
      });
    });

    return this.mapToDomain(updated);
  }

  async hasPaymentForReservation(reservationId: string): Promise<boolean> {
    const payment = await this.prisma.paiement.findUnique({
      where: { reservationId },
      select: { id: true },
    });

    return payment !== null;
  }

  async findPaymentIdForReservation(
    reservationId: string,
  ): Promise<string | null> {
    const payment = await this.prisma.paiement.findUnique({
      where: { reservationId },
      select: { id: true },
    });

    return payment?.id ?? null;
  }

  async submitClientReview(reservation: Reservation): Promise<Reservation> {
    const updated = await this.prisma.$transaction(async (tx) => {
      const writeResult = await tx.reservation.updateMany({
        where: {
          id: reservation.id,
          statut: 'TERMINEE',
          clientRating: null,
          clientReviewedAt: null,
        },
        data: {
          statut: reservation.statut,
          clientRating: reservation.clientRating,
          clientReview: reservation.clientReview,
          clientReviewedAt: reservation.clientReviewedAt,
          misAJourLe: reservation.misAJourLe,
        },
      });

      if (writeResult.count !== 1) {
        throw ReservationDomainError.reviewAlreadySubmitted();
      }

      const savedReservation = await tx.reservation.findUnique({
        where: { id: reservation.id },
        select: RESERVATION_SELECT,
      });

      if (!savedReservation) {
        throw ReservationDomainError.notFound();
      }

      const aggregate = await tx.reservation.aggregate({
        where: {
          professionnelId: reservation.professionnelId,
          clientRating: { not: null },
        },
        _avg: { clientRating: true },
        _count: { clientRating: true },
      });

      await tx.profilProfessionnel.update({
        where: { id: reservation.professionnelId },
        data: {
          noteGlobale: new Prisma.Decimal(aggregate._avg.clientRating ?? 0),
          nombreAvis: aggregate._count.clientRating,
        },
      });

      return savedReservation;
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

  async findAllDetailedByDateRange(
    startDate: Date,
    endDate: Date,
  ): Promise<ReservationDetailedView[]> {
    const reservations = await this.prisma.reservation.findMany({
      where: {
        dateHeure: {
          gte: startDate,
          lte: endDate,
        },
      },
      orderBy: { dateHeure: 'asc' },
      select: RESERVATION_DETAIL_SELECT,
    });

    return reservations.map((reservation) =>
      this.mapToDetailedView(reservation),
    );
  }

  async findByFilters(filters: {
    clientId?: string;
    professionalId?: string;
    serviceId?: string;
    status?: string;
    startDate?: Date;
    endDate?: Date;
    search?: string;
  }): Promise<Reservation[]> {
    const where = this.buildFilterWhere(filters);

    const reservations = await this.prisma.reservation.findMany({
      where,
      orderBy: { dateHeure: 'desc' },
      select: RESERVATION_SELECT,
    });

    return reservations.map((reservation) => this.mapToDomain(reservation));
  }

  async findDetailedByFilters(filters: {
    clientId?: string;
    professionalId?: string;
    serviceId?: string;
    status?: string;
    startDate?: Date;
    endDate?: Date;
    search?: string;
    limit?: number;
    offset?: number;
  }): Promise<ReservationDetailedView[]> {
    const where = this.buildFilterWhere(filters);

    const reservations = await this.prisma.reservation.findMany({
      where,
      orderBy: { dateHeure: 'desc' },
      take: filters.limit,
      skip: filters.offset,
      select: RESERVATION_DETAIL_SELECT,
    });

    return reservations.map((reservation) =>
      this.mapToDetailedView(reservation),
    );
  }

  async countByFilters(filters: {
    clientId?: string;
    professionalId?: string;
    serviceId?: string;
    status?: string;
    startDate?: Date;
    endDate?: Date;
    search?: string;
  }): Promise<number> {
    return this.prisma.reservation.count({
      where: this.buildFilterWhere(filters),
    });
  }

  async hasTimeSlotConflict(input: {
    professionalId: string;
    dateHeure: Date;
    dureeMinutes: number;
    excludeReservationId?: string;
  }): Promise<boolean> {
    return this.existsForTimeSlot(this.prisma, input);
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
      statutAjustementPrix:
        record.statutAjustementPrix as ReservationPriceAdjustmentStatus,
      prixAjustementPropose: record.prixAjustementPropose?.toNumber() ?? null,
      raisonAjustementPrix: record.raisonAjustementPrix,
      demandeAjustementPrixLe: record.demandeAjustementPrixLe,
      raisonAnnulation: record.raisonAnnulation,
      clientRating: record.clientRating,
      clientReview: record.clientReview,
      clientReviewedAt: record.clientReviewedAt,
      creeLe: record.creeLe,
      misAJourLe: record.misAJourLe,
    };
  }

  private mapToDetailedView(
    record: ReservationDetailRecord,
  ): ReservationDetailedView {
    return {
      ...this.mapToDomain(record),
      client: record.client,
      service: {
        ...record.service,
        typePrix: record.service.typePrix,
        prix: record.service.prix.toNumber(),
        categorie: {
          ...record.service.categorie,
          tauxCommission: record.service.categorie.tauxCommission.toNumber(),
        },
      },
      professionnel: {
        ...record.professionnel,
        noteGlobale: record.professionnel.noteGlobale.toNumber(),
      },
    };
  }

  private buildFilterWhere(filters: {
    clientId?: string;
    professionalId?: string;
    serviceId?: string;
    status?: string;
    startDate?: Date;
    endDate?: Date;
    search?: string;
  }): Prisma.ReservationWhereInput {
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

      if (filters.search) {
        where.OR = [
          { adresseClient: { contains: filters.search, mode: 'insensitive' } },
          {
            client: { nom: { contains: filters.search, mode: 'insensitive' } },
          },
          {
            service: { nom: { contains: filters.search, mode: 'insensitive' } },
          },
          {
            professionnel: {
              utilisateur: {
                nom: { contains: filters.search, mode: 'insensitive' },
              },
            },
          },
        ];
      }
      if (filters.endDate) {
        where.dateHeure.lte = filters.endDate;
      }
    }

    return where;
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
