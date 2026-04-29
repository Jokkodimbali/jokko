import { Inject } from '@nestjs/common';
import { appHttpException } from '../../../core/http/app-http.exception';
import {
  PROFESSIONALS_REPOSITORY_PORT,
  type ProfessionalsRepositoryPort,
} from '../../../professionals/application/ports/professionals-repository.port';
import {
  RESERVATIONS_REPOSITORY_PORT,
  type ReservationsRepositoryPort,
} from '../../../reservations/application/ports/reservations-repository.port';
import {
  USERS_REPOSITORY_PORT,
  type UsersRepositoryPort,
} from '../../../users/application/ports/users-repository.port';
import {
  MESSAGING_REPOSITORY_PORT,
  type MessagingRepositoryPort,
} from '../ports/messaging-repository.port';

export abstract class MessagingAppService {
  protected readonly defaultLimit = 20;
  protected readonly maxLimit = 100;

  constructor(
    @Inject(MESSAGING_REPOSITORY_PORT)
    protected readonly messagingRepository: MessagingRepositoryPort,
    @Inject(USERS_REPOSITORY_PORT)
    protected readonly usersRepository: UsersRepositoryPort,
    @Inject(PROFESSIONALS_REPOSITORY_PORT)
    protected readonly professionalsRepository: ProfessionalsRepositoryPort,
    @Inject(RESERVATIONS_REPOSITORY_PORT)
    protected readonly reservationsRepository: ReservationsRepositoryPort,
  ) {}

  protected normalizeLimit(limit?: number): number {
    if (!limit) {
      return this.defaultLimit;
    }

    return Math.min(Math.max(limit, 1), this.maxLimit);
  }

  protected normalizeOffset(offset?: number): number {
    if (!offset || offset < 0) {
      return 0;
    }

    return offset;
  }

  protected async getProfessionalProfileByUserIdOrThrow(userId: string) {
    const profile = await this.professionalsRepository.findByUserId(userId);
    if (!profile) {
      throw appHttpException('MESSAGING_PROFESSIONAL_NOT_FOUND');
    }

    return profile;
  }

  protected async getProfessionalProfileOrThrow(profileId: string) {
    const profile =
      await this.professionalsRepository.findVerifiedById(profileId);
    if (!profile) {
      throw appHttpException('MESSAGING_PROFESSIONAL_NOT_FOUND');
    }

    return profile;
  }

  protected async getClientUserOrThrow(userId: string) {
    const user = await this.usersRepository.findMeById(userId);
    if (!user || !user.estActif) {
      throw appHttpException('MESSAGING_CLIENT_NOT_FOUND');
    }

    return user;
  }

  protected async getReservationOrThrow(reservationId: string) {
    const reservation =
      await this.reservationsRepository.findById(reservationId);
    if (!reservation) {
      throw appHttpException('MESSAGING_RESERVATION_NOT_FOUND');
    }

    return reservation;
  }
}
