import { Inject, Injectable } from '@nestjs/common';
import { appHttpException } from '../../../core/http/app-http.exception';
import type { AuthUser } from '../../../auth/security/auth-user.type';
import {
  PROFESSIONALS_REPOSITORY_PORT,
  type ProfessionalsRepositoryPort,
} from '../ports/professionals-repository.port';
import { ProfessionalProfile } from '../../domain';
import type { CreateAvailabilityCommand } from '../commands/professionals.commands';

@Injectable()
export class AvailabilityService {
  constructor(
    @Inject(PROFESSIONALS_REPOSITORY_PORT)
    private readonly professionalsRepository: ProfessionalsRepositoryPort,
  ) {}

  async createAvailability(
    requestUser: AuthUser,
    command: CreateAvailabilityCommand,
  ) {
    this.assertProfessionalRole(requestUser.role);

    const result = await this.professionalsRepository.createAvailability({
      utilisateurId: requestUser.sub,
      dayOfWeek: command.dayOfWeek,
      startTime: this.toTimeDate(command.startTime),
      endTime: this.toTimeDate(command.endTime),
    });

    if (result.status === 'profile_not_found') {
      throw appHttpException('PROFESSIONALS_PROFILE_NOT_FOUND');
    }
    return result.availability;
  }

  async disableAvailability(requestUser: AuthUser, availabilityId: string) {
    this.assertProfessionalRole(requestUser.role);

    const result = await this.professionalsRepository.disableAvailability(
      requestUser.sub,
      availabilityId,
    );
    if (result.status === 'profile_not_found') {
      throw appHttpException('PROFESSIONALS_PROFILE_NOT_FOUND');
    }
    if (result.status === 'availability_not_found') {
      throw appHttpException('PROFESSIONALS_AVAILABILITY_NOT_FOUND');
    }
    return result.availability;
  }

  async listByProfile(profileId: string) {
    await this.ensureVerifiedProfile(profileId);
    return this.professionalsRepository.listAvailabilities(profileId);
  }

  private assertProfessionalRole(role: AuthUser['role']): void {
    if (!ProfessionalProfile.isProfessionalRole(role)) {
      throw appHttpException('PROFESSIONALS_FORBIDDEN_ROLE');
    }
  }

  private async ensureVerifiedProfile(profileId: string) {
    const profile =
      await this.professionalsRepository.findVerifiedById(profileId);
    if (!profile) {
      throw appHttpException('PROFESSIONALS_PROFILE_NOT_FOUND');
    }
    return profile;
  }

  private toTimeDate(time: string): Date {
    const [hoursRaw, minutesRaw] = time.split(':');
    const hours = Number(hoursRaw);
    const minutes = Number(minutesRaw);
    return new Date(Date.UTC(1970, 0, 1, hours, minutes, 0));
  }
}
