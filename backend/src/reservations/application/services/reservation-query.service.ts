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
    } else if (requestUser.role === 'PRESTATAIRE') {
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

    return this.reservationsRepository.findByFilters(filters);
  }

  async getReservationById(requestUser: AuthUser, reservationId: string) {
    return this.getAccessibleReservationOrThrow(requestUser, reservationId);
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

  async getAllReservationsByDateRange(
    requestUser: AuthUser,
    query: ListReservationsQuery,
  ) {
    this.assertAdminRole(requestUser.role);
    const { startDate, endDate } = this.parseDateRangeOrThrow(query);

    return this.reservationsRepository.findAllByDateRange(startDate, endDate);
  }

  async getReservationStatistics(
    requestUser: AuthUser,
    query: ListReservationsQuery,
  ) {
    this.assertAdminRole(requestUser.role);
    const { startDate, endDate } = this.parseDateRangeOrThrow(query);

    const reservations = await this.reservationsRepository.findAllByDateRange(
      startDate,
      endDate,
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
      if (!availability.estActive || availability.jourSemaine !== requestedDay) {
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
}
