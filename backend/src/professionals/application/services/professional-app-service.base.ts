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

  /**
   * Assert that the user has a professional (PRESTATAIRE) role.
   */
  protected assertProfessionalRole(role: AuthUser['role']): void {
    if (!ProfessionalProfile.isProfessionalRole(role)) {
      throw appHttpException('PROFESSIONALS_FORBIDDEN_ROLE');
    }
  }

  /**
   * Assert that the user has an ADMIN role.
   */
  protected assertAdminRole(role: AuthUser['role']): void {
    if (!ProfessionalProfile.isAdminRole(role)) {
      throw appHttpException('PROFESSIONALS_ADMIN_FORBIDDEN_ROLE');
    }
  }

  /**
   * Assert that the professional profile exists and KYC is verified.
   */
  protected async assertKycVerified(userId: string): Promise<void> {
    const profile = await this.professionalsRepository.findByUserId(userId);
    if (!profile) {
      throw appHttpException('PROFESSIONALS_PROFILE_NOT_FOUND');
    }
    if (profile.statutKyc !== 'VERIFIE') {
      throw appHttpException('PROFESSIONALS_KYC_NOT_VERIFIED');
    }
  }

  /**
   * Assert that a profile exists and is verified (public access).
   */
  protected async assertVerifiedProfile(profileId: string): Promise<void> {
    const profile =
      await this.professionalsRepository.findVerifiedById(profileId);
    if (!profile) {
      throw appHttpException('PROFESSIONALS_PROFILE_NOT_FOUND');
    }
  }

  /**
   * Assert that a payload has at least one field defined.
   */
  protected assertNonEmptyUpdate(payload: Record<string, unknown>): void {
    if (Object.values(payload).every((v) => v === undefined)) {
      throw appHttpException('PROFESSIONALS_UPDATE_EMPTY');
    }
  }
}
