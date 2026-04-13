import { Inject, Injectable } from '@nestjs/common';
import { TypePrix, StatutKyc } from '@prisma/client';
import { appHttpException } from '../../../core/http/app-http.exception';
import type { AuthUser } from '../../../auth/security/auth-user.type';
import {
  PROFESSIONALS_REPOSITORY_PORT,
  type ProfessionalsRepositoryPort,
} from '../ports/professionals-repository.port';
import { ProfessionalProfile } from '../../domain';
import type {
  CreateProfessionalServiceCommand,
  UpdateProfessionalServiceCommand,
} from '../commands/professionals.commands';

@Injectable()
export class ServiceManagementService {
  constructor(
    @Inject(PROFESSIONALS_REPOSITORY_PORT)
    private readonly professionalsRepository: ProfessionalsRepositoryPort,
  ) {}

  async createService(
    requestUser: AuthUser,
    command: CreateProfessionalServiceCommand,
  ) {
    this.assertProfessionalRole(requestUser.role);
    await this.ensureKycVerifiedForUser(requestUser.sub);

    const result = await this.professionalsRepository.createService({
      utilisateurId: requestUser.sub,
      categoryId: command.categoryId,
      name: command.name.trim(),
      description: command.description.trim(),
      price: command.price,
      priceType: command.priceType as TypePrix,
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
    await this.ensureKycVerifiedForUser(requestUser.sub);

    if (
      command.name === undefined &&
      command.description === undefined &&
      command.price === undefined &&
      command.priceType === undefined
    ) {
      throw appHttpException('USERS_UPDATE_EMPTY');
    }

    const result = await this.professionalsRepository.updateService({
      utilisateurId: requestUser.sub,
      serviceId,
      name: command.name?.trim(),
      description: command.description?.trim(),
      price: command.price,
      priceType: command.priceType as TypePrix | undefined,
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
    await this.ensureKycVerifiedForUser(requestUser.sub);

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
    await this.ensureVerifiedProfile(profileId);
    return this.professionalsRepository.listServices(profileId);
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

  private async ensureKycVerifiedForUser(userId: string) {
    const profile = await this.professionalsRepository.findByUserId(userId);
    if (!profile) {
      throw appHttpException('PROFESSIONALS_PROFILE_NOT_FOUND');
    }
    if (profile.statutKyc !== StatutKyc.VERIFIE) {
      throw appHttpException('PROFESSIONALS_KYC_NOT_VERIFIED');
    }
    return profile;
  }
}
