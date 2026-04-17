import { Injectable } from '@nestjs/common';
import type { AuthUser } from '../../../auth/security/auth-user.type';
import { appHttpException } from '../../../core/http/app-http.exception';
import type { ListReservationsQuery } from '../commands/reservations.commands';
import { ReservationAppService } from './reservation-app-service.base';

@Injectable()
export class ReservationQueryService extends ReservationAppService {
  async getMyReservations(requestUser: AuthUser, query: ListReservationsQuery) {
    if (requestUser.role === 'CLIENT') {
      if (query.startDate || query.endDate) {
        const { startDate, endDate } = this.parseDateRangeOrThrow(query);
        return this.reservationsRepository.findByClientAndDateRange(
          requestUser.sub,
          startDate,
          endDate,
        );
      }

      return this.reservationsRepository.findByClient(requestUser.sub);
    }

    if (requestUser.role === 'PRESTATAIRE') {
      if (query.scope === 'CLIENT') {
        if (query.startDate || query.endDate) {
          const { startDate, endDate } = this.parseDateRangeOrThrow(query);
          return this.reservationsRepository.findByClientAndDateRange(
            requestUser.sub,
            startDate,
            endDate,
          );
        }

        return this.reservationsRepository.findByClient(requestUser.sub);
      }

      const profile = await this.getProfessionalProfileOrThrow(requestUser.sub);
      if (query.startDate || query.endDate) {
        const { startDate, endDate } = this.parseDateRangeOrThrow(query);
        return this.reservationsRepository.findByProfessionalAndDateRange(
          profile.id,
          startDate,
          endDate,
        );
      }

      return this.reservationsRepository.findByProfessional(profile.id);
    }

    throw appHttpException('RESERVATIONS_FORBIDDEN_ROLE');
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
}
