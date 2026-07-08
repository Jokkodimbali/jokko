import { Inject, Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { TypePrix } from '@prisma/client';
import { appHttpException } from '../../../core/http/app-http.exception';
import type { AuthUser } from '../../../auth/security/auth-user.type';
import {
  PROFESSIONALS_REPOSITORY_PORT,
  type ProfessionalsRepositoryPort,
} from '../ports/professionals-repository.port';
import type {
  CreateProfessionalServiceCommand,
  UpdateProfessionalServiceCommand,
} from '../commands/professionals.commands';
import { ProfessionalAppService } from './professional-app-service.base';

@Injectable()
export class ServiceManagementService extends ProfessionalAppService {
  constructor(
    @Inject(PROFESSIONALS_REPOSITORY_PORT)
    professionalsRepository: ProfessionalsRepositoryPort,
    private readonly realtimeEvents: EventEmitter2,
  ) {
    super(professionalsRepository);
  }

  async createService(
    requestUser: AuthUser,
    command: CreateProfessionalServiceCommand,
  ) {
    this.assertProfessionalRole(requestUser.role);
    await this.assertKycVerified(requestUser.sub);

    const result = await this.professionalsRepository.createService({
      utilisateurId: requestUser.sub,
      categoryId: command.categoryId,
      name: command.name.trim(),
      description: command.description.trim(),
      price: command.price,
      priceType: command.priceType as TypePrix,
      travelMode: command.travelMode,
      durationMinutes: command.durationMinutes,
      pauseMinutes: command.pauseMinutes,
      isRequired: command.isRequired,
    });

    if (result.status === 'profile_not_found') {
      throw appHttpException('PROFESSIONALS_PROFILE_NOT_FOUND');
    }
    if (result.status === 'category_not_found') {
      throw appHttpException('PROFESSIONALS_CATEGORY_NOT_FOUND');
    }

    this.emitAvailabilityChanged(
      result.service.profilProfessionnelId,
      'service',
    );
    return result.service;
  }

  async updateService(
    requestUser: AuthUser,
    serviceId: string,
    command: UpdateProfessionalServiceCommand,
  ) {
    this.assertProfessionalRole(requestUser.role);
    await this.assertKycVerified(requestUser.sub);
    this.assertNonEmptyUpdate(command as Record<string, unknown>);

    const result = await this.professionalsRepository.updateService({
      utilisateurId: requestUser.sub,
      serviceId,
      name: command.name?.trim(),
      description: command.description?.trim(),
      price: command.price,
      priceType: command.priceType as TypePrix | undefined,
      travelMode: command.travelMode,
      durationMinutes: command.durationMinutes,
      pauseMinutes: command.pauseMinutes,
      isRequired: command.isRequired,
    });

    if (result.status === 'profile_not_found') {
      throw appHttpException('PROFESSIONALS_PROFILE_NOT_FOUND');
    }
    if (result.status === 'service_not_found') {
      throw appHttpException('PROFESSIONALS_SERVICE_NOT_FOUND');
    }

    this.emitAvailabilityChanged(
      result.service.profilProfessionnelId,
      'service',
    );
    return result.service;
  }

  async disableService(requestUser: AuthUser, serviceId: string) {
    this.assertProfessionalRole(requestUser.role);
    await this.assertKycVerified(requestUser.sub);

    const result = await this.professionalsRepository.disableService(
      requestUser.sub,
      serviceId,
    );
    if (result.status === 'profile_not_found') {
      throw appHttpException('PROFESSIONALS_PROFILE_NOT_FOUND');
    }
    if (result.status === 'service_not_found') {
      throw appHttpException('PROFESSIONALS_SERVICE_NOT_FOUND');
    }
    this.emitAvailabilityChanged(
      result.service.profilProfessionnelId,
      'service',
    );
    return result.service;
  }

  async listServicesByProfile(profileId: string) {
    await this.assertVerifiedProfile(profileId);
    return this.professionalsRepository.listServices(profileId);
  }

  async listMyServices(requestUser: AuthUser) {
    this.assertProfessionalRole(requestUser.role);
    const profile = await this.ensureProfessionalProfile(requestUser.sub);

    return this.professionalsRepository.listServices(profile.id);
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
