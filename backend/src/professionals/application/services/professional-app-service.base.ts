import { Inject, Injectable } from '@nestjs/common';
import { appHttpException } from '../../../core/http/app-http.exception';
import type { AuthUser } from '../../../auth/security/auth-user.type';
import {
  PROFESSIONALS_REPOSITORY_PORT,
  type ProfessionalProfileView,
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
    const profile = await this.ensureProfessionalProfile(userId);
    if (profile.statutKyc !== 'VERIFIE') {
      throw appHttpException('PROFESSIONALS_KYC_NOT_VERIFIED');
    }
  }

  protected async ensureProfessionalProfile(
    userId: string,
  ): Promise<ProfessionalProfileView> {
    const profile = await this.professionalsRepository.findByUserId(userId);
    if (profile) return profile;

    const result = await this.professionalsRepository.createProfile({
      utilisateurId: userId,
      biographie: null,
      nomEntreprise: null,
      ville: null,
    });

    if (result.status === 'created') {
      return result.profile;
    }

    if (result.status === 'already_exists') {
      const existingProfile =
        await this.professionalsRepository.findByUserId(userId);
      if (existingProfile) return existingProfile;
    }

    if (result.status === 'user_not_found') {
      throw appHttpException('AUTH_USER_NOT_FOUND');
    }

    throw appHttpException('PROFESSIONALS_PROFILE_NOT_FOUND');
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
