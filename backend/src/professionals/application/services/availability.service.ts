import { Injectable } from '@nestjs/common';
import { appHttpException } from '../../../core/http/app-http.exception';
import type { AuthUser } from '../../../auth/security/auth-user.type';
import { TimeOfDay } from '../../domain';
import type { CreateAvailabilityCommand } from '../commands/professionals.commands';
import { ProfessionalAppService } from './professional-app-service.base';

@Injectable()
export class AvailabilityService extends ProfessionalAppService {
  async createAvailability(
    requestUser: AuthUser,
    command: CreateAvailabilityCommand,
  ) {
    this.assertProfessionalRole(requestUser.role);

    const startTime = TimeOfDay.fromString(command.startTime).toDate();
    const endTime = TimeOfDay.fromString(command.endTime).toDate();

    const result = await this.professionalsRepository.createAvailability({
      utilisateurId: requestUser.sub,
      dayOfWeek: command.dayOfWeek,
      startTime,
      endTime,
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
    await this.assertVerifiedProfile(profileId);
    return this.professionalsRepository.listAvailabilities(profileId);
  }

  async listMyAvailabilities(requestUser: AuthUser) {
    this.assertProfessionalRole(requestUser.role);
    const profile = await this.ensureProfessionalProfile(requestUser.sub);

    return this.professionalsRepository.listAvailabilities(profile.id);
  }
}
