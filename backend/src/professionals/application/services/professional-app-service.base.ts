import { Inject, Injectable } from '@nestjs/common';
import { appHttpException } from '../../../core/http/app-http.exception';
import type { AuthUser } from '../../../auth/security/auth-user.type';
import {
  PROFESSIONALS_REPOSITORY_PORT,
  type ProfessionalsRepositoryPort,
} from '../ports/professionals-repository.port';
import { ProfessionalProfile } from '../../domain';

/**
 * Abstract base class for all professional application services.
 * Extracts shared role verification and KYC checks to respect DRY.
 */
@Injectable()
export abstract class ProfessionalAppService {
  constructor(
    @Inject(PROFESSIONALS_REPOSITORY_PORT)
    protected readonly professionalsRepository: ProfessionalsRepositoryPort,
  ) {}

  protected assertProfessionalRole(role: AuthUser['role']): void {
    if (!ProfessionalProfile.isProfessionalRole(role)) {
      throw appHttpException('PROFESSIONALS_FORBIDDEN_ROLE');
    }
  }

  protected assertAdminRole(role: AuthUser['role']): void {
    if (!ProfessionalProfile.isAdminRole(role)) {
      throw appHttpException('PROFESSIONALS_ADMIN_FORBIDDEN_ROLE');
    }
  }

  protected async assertKycVerified(userId: string): Promise<void> {
    const profile = await this.professionalsRepository.findByUserId(userId);
    if (!profile) {
      throw appHttpException('PROFESSIONALS_PROFILE_NOT_FOUND');
    }
    if (profile.statutKyc !== 'VERIFIE') {
      throw appHttpException('PROFESSIONALS_KYC_NOT_VERIFIED');
    }
  }

  protected async assertVerifiedProfile(profileId: string): Promise<void> {
    const profile =
      await this.professionalsRepository.findVerifiedById(profileId);
    if (!profile) {
      throw appHttpException('PROFESSIONALS_PROFILE_NOT_FOUND');
    }
  }

  protected assertNonEmptyUpdate(payload: Record<string, unknown>): void {
    if (Object.values(payload).every((v) => v === undefined)) {
      throw appHttpException('PROFESSIONALS_UPDATE_EMPTY');
    }
  }
}
