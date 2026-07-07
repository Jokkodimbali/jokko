import { Inject, Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { appHttpException } from '../../../core/http/app-http.exception';
import type { AuthUser } from '../../../auth/security/auth-user.type';
import { TimeOfDay } from '../../domain';
import {
  PROFESSIONALS_REPOSITORY_PORT,
  type ProfessionalsRepositoryPort,
} from '../ports/professionals-repository.port';
import type {
  CreateAvailabilityCommand,
  UpdateAvailabilityCommand,
} from '../commands/professionals.commands';
import { ProfessionalAppService } from './professional-app-service.base';

@Injectable()
export class AvailabilityService extends ProfessionalAppService {
  constructor(
    @Inject(PROFESSIONALS_REPOSITORY_PORT)
    professionalsRepository: ProfessionalsRepositoryPort,
    private readonly realtimeEvents: EventEmitter2,
  ) {
    super(professionalsRepository);
  }

  async createAvailability(
    requestUser: AuthUser,
    command: CreateAvailabilityCommand,
  ) {
    this.assertProfessionalRole(requestUser.role);
    const profile = await this.ensureProfessionalProfile(requestUser.sub);

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
    this.emitAvailabilityChanged(profile.id, 'availability');
    return result.availability;
  }

  async disableAvailability(requestUser: AuthUser, availabilityId: string) {
    this.assertProfessionalRole(requestUser.role);
    const profile = await this.ensureProfessionalProfile(requestUser.sub);

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
    this.emitAvailabilityChanged(profile.id, 'availability');
    return result.availability;
  }

  async updateAvailability(
    requestUser: AuthUser,
    availabilityId: string,
    command: UpdateAvailabilityCommand,
  ) {
    this.assertProfessionalRole(requestUser.role);
    const profile = await this.ensureProfessionalProfile(requestUser.sub);

    const startTime = TimeOfDay.fromString(command.startTime).toDate();
    const endTime = TimeOfDay.fromString(command.endTime).toDate();

    const result = await this.professionalsRepository.updateAvailability({
      utilisateurId: requestUser.sub,
      availabilityId,
      dayOfWeek: command.dayOfWeek,
      startTime,
      endTime,
    });

    if (result.status === 'profile_not_found') {
      throw appHttpException('PROFESSIONALS_PROFILE_NOT_FOUND');
    }
    if (result.status === 'availability_not_found') {
      throw appHttpException('PROFESSIONALS_AVAILABILITY_NOT_FOUND');
    }
    this.emitAvailabilityChanged(profile.id, 'availability');
    return result.availability;
  }

  async listByProfile(profileId: string) {
    const profile =
      await this.professionalsRepository.findVerifiedById(profileId);
    if (!profile) {
      throw appHttpException('PROFESSIONALS_PROFILE_NOT_FOUND');
    }
    return this.professionalsRepository.listAvailabilities(profileId);
  }

  async listMyAvailabilities(requestUser: AuthUser) {
    this.assertProfessionalRole(requestUser.role);
    const profile = await this.ensureProfessionalProfile(requestUser.sub);

    return this.professionalsRepository.listAvailabilities(profile.id);
  }

  private emitAvailabilityChanged(
    professionalId: string,
    reason: 'availability' | 'service',
  ): void {
    this.realtimeEvents.emit('professional.availability.changed', {
      professionalId,
      changedAt: new Date().toISOString(),
      reason,
    });
  }
}
