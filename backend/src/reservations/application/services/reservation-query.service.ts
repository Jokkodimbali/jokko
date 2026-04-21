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
}
