import { Injectable } from '@nestjs/common';
import { TypePrix } from '@prisma/client';
import { appHttpException } from '../../../core/http/app-http.exception';
import type { AuthUser } from '../../../auth/security/auth-user.type';
import type {
  CreateProfessionalServiceCommand,
  UpdateProfessionalServiceCommand,
} from '../commands/professionals.commands';
import { ProfessionalAppService } from './professional-app-service.base';

@Injectable()
export class ServiceManagementService extends ProfessionalAppService {
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
      durationMinutes: command.durationMinutes,
      isRequired: command.isRequired,
    });

    if (result.status === 'profile_not_found') {
      throw appHttpException('PROFESSIONALS_PROFILE_NOT_FOUND');
    }
    if (result.status === 'category_not_found') {
      throw appHttpException('PROFESSIONALS_CATEGORY_NOT_FOUND');
    }

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
      durationMinutes: command.durationMinutes,
      isRequired: command.isRequired,
    });

    if (result.status === 'profile_not_found') {
      throw appHttpException('PROFESSIONALS_PROFILE_NOT_FOUND');
    }
    if (result.status === 'service_not_found') {
      throw appHttpException('PROFESSIONALS_SERVICE_NOT_FOUND');
    }

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
    return result.service;
  }

  async listServicesByProfile(profileId: string) {
    await this.assertVerifiedProfile(profileId);
    return this.professionalsRepository.listServices(profileId);
  }

  async listMyServices(requestUser: AuthUser) {
    this.assertProfessionalRole(requestUser.role);
    const profile = await this.professionalsRepository.findByUserId(
      requestUser.sub,
    );
    if (!profile) {
      throw appHttpException('PROFESSIONALS_PROFILE_NOT_FOUND');
    }

    return this.professionalsRepository.listServices(profile.id);
  }
}
