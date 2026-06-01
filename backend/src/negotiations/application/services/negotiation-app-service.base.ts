import { Inject, Injectable } from '@nestjs/common';
import type { AuthUser } from '../../../auth/security/auth-user.type';
import { appHttpException } from '../../../core/http/app-http.exception';
import {
  PROFESSIONALS_REPOSITORY_PORT,
  type ProfessionalProfileView,
  type ProfessionalServiceView,
  type ProfessionalsRepositoryPort,
} from '../../../professionals/application/ports/professionals-repository.port';
import {
  NEGOTIATIONS_REPOSITORY_PORT,
  type NegotiationView,
  type NegotiationsRepositoryPort,
} from '../ports/negotiations-repository.port';

@Injectable()
export abstract class NegotiationAppService {
  constructor(
    @Inject(NEGOTIATIONS_REPOSITORY_PORT)
    protected readonly negotiationsRepository: NegotiationsRepositoryPort,
    @Inject(PROFESSIONALS_REPOSITORY_PORT)
    protected readonly professionalsRepository: ProfessionalsRepositoryPort,
  ) {}

  protected assertClientRole(role: AuthUser['role']): void {
    if (role !== 'CLIENT' && role !== 'PRESTATAIRE' && role !== 'MEDECIN') {
      throw appHttpException('NEGOTIATIONS_CLIENT_ROLE_REQUIRED');
    }
  }

  protected assertProfessionalRole(role: AuthUser['role']): void {
    if (role !== 'PRESTATAIRE' && role !== 'MEDECIN') {
      throw appHttpException('NEGOTIATIONS_PROFESSIONAL_ROLE_REQUIRED');
    }
  }

  protected async getServiceOrThrow(
    serviceId: string,
  ): Promise<ProfessionalServiceView> {
    const service =
      await this.professionalsRepository.getServiceById(serviceId);
    if (!service) {
      throw appHttpException('PROFESSIONALS_SERVICE_NOT_FOUND');
    }

    return service;
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

  protected async getNegotiationOrThrow(
    negotiationId: string,
  ): Promise<NegotiationView> {
    const negotiation =
      await this.negotiationsRepository.findById(negotiationId);
    if (!negotiation) {
      throw appHttpException('NEGOTIATIONS_NOT_FOUND');
    }

    return negotiation;
  }

  protected normalizeLimit(limit?: number): number {
    if (!limit) {
      return 20;
    }

    return Math.min(Math.max(limit, 1), 100);
  }

  protected normalizeOffset(offset?: number): number {
    if (!offset || offset < 0) {
      return 0;
    }

    return offset;
  }
}
