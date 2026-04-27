import { Inject, Injectable } from '@nestjs/common';
import type { AuthUser } from '../../../auth/security/auth-user.type';
import { appHttpException } from '../../../core/http/app-http.exception';
import {
  PROFESSIONALS_REPOSITORY_PORT,
  type ProfessionalProfileView,
  type ProfessionalServiceView,
  type ProfessionalsRepositoryPort,
} from '../../../professionals/application/ports/professionals-repository.port';
import type { Reservation } from '../../domain/entities/reservation.entity';
import {
  RESERVATIONS_REPOSITORY_PORT,
  type ReservationsRepositoryPort,
} from '../ports/reservations-repository.port';

@Injectable()
export abstract class ReservationAppService {
  constructor(
    @Inject(RESERVATIONS_REPOSITORY_PORT)
    protected readonly reservationsRepository: ReservationsRepositoryPort,
    @Inject(PROFESSIONALS_REPOSITORY_PORT)
    protected readonly professionalsRepository: ProfessionalsRepositoryPort,
  ) {}

  protected assertClientRole(role: AuthUser['role']): void {
    if (role !== 'CLIENT' && role !== 'PRESTATAIRE') {
      throw appHttpException('RESERVATIONS_FORBIDDEN_ROLE');
    }
  }

  protected assertProfessionalRole(role: AuthUser['role']): void {
    if (role !== 'PRESTATAIRE') {
      throw appHttpException('RESERVATIONS_FORBIDDEN_ROLE');
    }
  }

  protected assertAdminRole(role: AuthUser['role']): void {
    if (role !== 'ADMIN') {
      throw appHttpException('RESERVATIONS_FORBIDDEN_ROLE');
    }
  }

  protected parseDateOrThrow(value: string): Date {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      throw appHttpException('VALIDATION_REQUEST_INVALID');
    }

    return date;
  }

  protected parseDateRangeOrThrow(query: {
    startDate?: string;
    endDate?: string;
  }): { startDate: Date; endDate: Date } {
    if (!query.startDate || !query.endDate) {
      throw appHttpException('RESERVATIONS_DATE_RANGE_REQUIRED');
    }

    const startDate = this.parseDateOrThrow(query.startDate);
    const endDate = this.parseDateOrThrow(query.endDate);
    if (startDate.getTime() > endDate.getTime()) {
      throw appHttpException('VALIDATION_REQUEST_INVALID');
    }

    return { startDate, endDate };
  }

  protected async getReservationOrThrow(
    reservationId: string,
  ): Promise<Reservation> {
    const reservation =
      await this.reservationsRepository.findById(reservationId);
    if (!reservation) {
      throw appHttpException('RESERVATIONS_NOT_FOUND');
    }

    return reservation;
  }

  protected async getAccessibleReservationOrThrow(
    requestUser: AuthUser,
    reservationId: string,
  ): Promise<Reservation> {
    const reservation = await this.getReservationOrThrow(reservationId);

    if (requestUser.role === 'ADMIN') {
      return reservation;
    }

    if (
      requestUser.role === 'CLIENT' &&
      reservation.clientId === requestUser.sub
    ) {
      return reservation;
    }

    if (requestUser.role === 'PRESTATAIRE') {
      if (reservation.clientId === requestUser.sub) {
        return reservation;
      }

      const profile = await this.getProfessionalProfileOrThrow(requestUser.sub);
      if (reservation.professionnelId === profile.id) {
        return reservation;
      }
    }

    throw appHttpException('RESERVATIONS_UNAUTHORIZED');
  }

  protected async getProfessionalProfileOrThrow(
    userId: string,
  ): Promise<ProfessionalProfileView> {
    const profile = await this.professionalsRepository.findByUserId(userId);
    if (!profile) {
      throw appHttpException('PROFESSIONALS_PROFILE_NOT_FOUND');
    }

    return profile;
  }

  protected async getVerifiedProfessionalOrThrow(
    professionnelId: string,
  ): Promise<ProfessionalProfileView> {
    const profile =
      await this.professionalsRepository.findVerifiedById(professionnelId);
    if (!profile) {
      throw appHttpException('RESERVATIONS_PROFESSIONAL_NOT_FOUND');
    }

    return profile;
  }

  protected async getServiceOrThrow(
    serviceId: string,
  ): Promise<ProfessionalServiceView> {
    const service =
      await this.professionalsRepository.getServiceById(serviceId);
    if (!service) {
      throw appHttpException('RESERVATIONS_SERVICE_NOT_FOUND');
    }

    return service;
  }
}
