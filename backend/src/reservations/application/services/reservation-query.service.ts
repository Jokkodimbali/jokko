import { Injectable } from '@nestjs/common';
import type { AuthUser } from '../../../auth/security/auth-user.type';
import { appHttpException } from '../../../core/http/app-http.exception';
import type {
  ListReservationsQuery,
  ReservationFilters,
} from '../commands/reservations.commands';
import { ReservationAppService } from './reservation-app-service.base';

@Injectable()
export class ReservationQueryService extends ReservationAppService {
  async getMyReservations(requestUser: AuthUser, query: ListReservationsQuery) {
    const filters: ReservationFilters = {};

    if (requestUser.role === 'CLIENT') {
      filters.clientId = requestUser.sub;
    } else if (requestUser.role === 'PRESTATAIRE' || requestUser.role === 'MEDECIN') {
      if (query.scope === 'CLIENT') {
        filters.clientId = requestUser.sub;
      } else {
        const profile = await this.getProfessionalProfileOrThrow(
          requestUser.sub,
        );
        filters.professionalId = profile.id;
      }
    } else {
      throw appHttpException('RESERVATIONS_FORBIDDEN_ROLE');
    }

    if (query.startDate || query.endDate) {
      const { startDate, endDate } = this.parseDateRangeOrThrow(query);
      filters.startDate = startDate;
      filters.endDate = endDate;
    }

    if (query.status) {
      filters.status = query.status;
    }

    if (query.serviceId) {
      filters.serviceId = query.serviceId;
    }

    return this.reservationsRepository.findDetailedByFilters(filters);
  }

  async getReservationById(requestUser: AuthUser, reservationId: string) {
    await this.getAccessibleReservationOrThrow(requestUser, reservationId);
    const reservation =
      await this.reservationsRepository.findDetailedById(reservationId);
    if (!reservation) {
      throw appHttpException('RESERVATIONS_NOT_FOUND');
    }

    return reservation;
  }

  async checkAvailability(query: {
    professionalId: string;
    dateHeure: string;
    dureeMinutes: number;
  }) {
    const professional = await this.getVerifiedProfessionalOrThrow(
      query.professionalId,
    );
    const scheduledAt = this.parseDateOrThrow(query.dateHeure);
    const durationMinutes = Math.trunc(Number(query.dureeMinutes));

    if (
      !Number.isInteger(durationMinutes) ||
      durationMinutes < 15 ||
      durationMinutes > 1440 ||
      scheduledAt.getTime() <= Date.now()
    ) {
      return {
        available: false,
        reason: 'Date ou duree invalide.',
        professionalId: professional.id,
        dateHeure: scheduledAt.toISOString(),
        dureeMinutes: durationMinutes,
        withinAvailability: false,
        hasConflict: false,
      };
    }

    const availabilities =
      await this.professionalsRepository.listAvailabilities(professional.id);
    const withinAvailability = this.isWithinProfessionalAvailability(
      scheduledAt,
      durationMinutes,
      availabilities,
    );

    if (!withinAvailability) {
      return {
        available: false,
        reason: 'Le prestataire nest pas disponible sur cette plage horaire.',
        professionalId: professional.id,
        dateHeure: scheduledAt.toISOString(),
        dureeMinutes: durationMinutes,
        withinAvailability,
        hasConflict: false,
      };
    }

    const hasConflict = await this.reservationsRepository.hasTimeSlotConflict({
      professionalId: professional.id,
      dateHeure: scheduledAt,
      dureeMinutes: durationMinutes,
    });

    return {
      available: !hasConflict,
      reason: hasConflict
        ? 'Ce creneau est deja reserve pour ce prestataire.'
        : 'Ce creneau est disponible.',
      professionalId: professional.id,
      dateHeure: scheduledAt.toISOString(),
      dureeMinutes: durationMinutes,
      withinAvailability,
      hasConflict,
    };
  }

  async listAvailabilitySlots(query: {
    professionalId: string;
    date: string;
    dureeMinutes: number;
  }) {
    const professional = await this.getVerifiedProfessionalOrThrow(
      query.professionalId,
    );
    const dayStart = this.parseAvailabilityDateOrThrow(query.date);
    const durationMinutes = Math.trunc(Number(query.dureeMinutes));

    if (
      !Number.isInteger(durationMinutes) ||
      durationMinutes < 15 ||
      durationMinutes > 1440
    ) {
      return {
        professionalId: professional.id,
        date: dayStart.toISOString().slice(0, 10),
        dureeMinutes: durationMinutes,
        slots: [],
      };
    }

    const availabilities =
      await this.professionalsRepository.listAvailabilities(professional.id);
    const dayAvailabilities = availabilities.filter(
      (availability) =>
        availability.estActive &&
        availability.jourSemaine === dayStart.getUTCDay(),
    );
    const slotStarts = this.buildSlotStartsForDay(
      dayStart,
      durationMinutes,
      dayAvailabilities,
    );

    const slots = await Promise.all(
      slotStarts.map(async (slotStart) => {
        const isPast = slotStart.getTime() <= Date.now();
        const hasConflict = isPast
          ? false
          : await this.reservationsRepository.hasTimeSlotConflict({
              professionalId: professional.id,
              dateHeure: slotStart,
              dureeMinutes: durationMinutes,
            });
        const available = !isPast && !hasConflict;

        return {
          dateHeure: slotStart.toISOString(),
          label: this.formatSlotLabel(slotStart),
          available,
          status: available
            ? 'AVAILABLE'
            : hasConflict
              ? 'RESERVED'
              : 'UNAVAILABLE',
          reason: available
            ? 'Disponible'
            : hasConflict
              ? 'Deja reserve'
              : 'Non disponible',
        };
      }),
    );

    return {
      professionalId: professional.id,
      date: dayStart.toISOString().slice(0, 10),
      dureeMinutes: durationMinutes,
      slots,
    };
  }

  async getAllReservationsByDateRange(
    requestUser: AuthUser,
    query: ListReservationsQuery,
  ) {
    this.assertAdminRole(requestUser.role);
    const filters = this.adminFilters(query);
    const [items, total] = await Promise.all([
      this.reservationsRepository.findDetailedByFilters({
        ...filters,
        limit: query.limit ?? 20,
        offset: query.offset ?? 0,
      }),
      this.reservationsRepository.countByFilters(filters),
    ]);
    return { items, total, limit: query.limit ?? 20, offset: query.offset ?? 0 };
  }

  private adminFilters(query: ListReservationsQuery) {
    const sharedFilters = {
      status: query.status,
      serviceId: query.serviceId,
      clientId: query.clientId,
      professionalId: query.professionalId,
      search: query.search?.trim() || undefined,
    };
    if (!query.startDate && !query.endDate) {
      return sharedFilters;
    }

    const { startDate, endDate } = this.parseDateRangeOrThrow(query);
    return { ...sharedFilters, startDate, endDate };
  }

  async getReservationStatistics(
    requestUser: AuthUser,
    query: ListReservationsQuery,
  ) {
    this.assertAdminRole(requestUser.role);
    const reservations = await this.reservationsRepository.findByFilters(
      this.adminFilters(query),
    );

    const total = reservations.length;
    const byStatus = reservations.reduce(
      (acc, r) => {
        acc[r.statut] = (acc[r.statut] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    const cancellationRate = total > 0 ? (byStatus['ANNULEE'] || 0) / total : 0;
    const completionRate = total > 0 ? (byStatus['TERMINEE'] || 0) / total : 0;

    return {
      total,
      byStatus,
      cancellationRate,
      completionRate,
    };
  }

  private async findAdminReservationsByDateRange(
    query: ListReservationsQuery,
  ) {
    const { startDate, endDate } = this.parseDateRangeOrThrow(query);
    return this.reservationsRepository.findAllByDateRange(startDate, endDate);
  }

  private isWithinProfessionalAvailability(
    scheduledAt: Date,
    durationMinutes: number,
    availabilities: Array<{
      jourSemaine: number;
      heureDebut: Date;
      heureFin: Date;
      estActive: boolean;
    }>,
  ): boolean {
    const requestedStartMinutes =
      scheduledAt.getUTCHours() * 60 + scheduledAt.getUTCMinutes();
    const requestedEndMinutes = requestedStartMinutes + durationMinutes;
    const requestedDay = scheduledAt.getUTCDay();

    return availabilities.some((availability) => {
      if (
        !availability.estActive ||
        availability.jourSemaine !== requestedDay
      ) {
        return false;
      }

      const availabilityStartMinutes =
        availability.heureDebut.getUTCHours() * 60 +
        availability.heureDebut.getUTCMinutes();
      const availabilityEndMinutes =
        availability.heureFin.getUTCHours() * 60 +
        availability.heureFin.getUTCMinutes();

      return (
        requestedStartMinutes >= availabilityStartMinutes &&
        requestedEndMinutes <= availabilityEndMinutes
      );
    });
  }

  private parseAvailabilityDateOrThrow(value: string): Date {
    const normalized = value.length === 10 ? `${value}T00:00:00.000Z` : value;
    const date = this.parseDateOrThrow(normalized);
    date.setUTCHours(0, 0, 0, 0);
    return date;
  }

  private buildSlotStartsForDay(
    dayStart: Date,
    durationMinutes: number,
    availabilities: Array<{
      heureDebut: Date;
      heureFin: Date;
    }>,
  ): Date[] {
    const slotStepMinutes = 30;
    const starts: Date[] = [];

    for (const availability of availabilities) {
      const startMinutes =
        availability.heureDebut.getUTCHours() * 60 +
        availability.heureDebut.getUTCMinutes();
      const endMinutes =
        availability.heureFin.getUTCHours() * 60 +
        availability.heureFin.getUTCMinutes();

      for (
        let minute = startMinutes;
        minute + durationMinutes <= endMinutes;
        minute += slotStepMinutes
      ) {
        const slotStart = new Date(dayStart);
        slotStart.setUTCMinutes(minute);
        starts.push(slotStart);
      }
    }

    return starts.sort((a, b) => a.getTime() - b.getTime());
  }

  private formatSlotLabel(value: Date): string {
    const hours = value.getUTCHours().toString().padStart(2, '0');
    const minutes = value.getUTCMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  }
}
