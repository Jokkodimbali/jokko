import { Inject, Injectable } from '@nestjs/common';
import { appHttpException } from '../../../core/http/app-http.exception';
import type { AuthUser } from '../../../auth/security/auth-user.type';
import {
  PROFESSIONALS_REPOSITORY_PORT,
  type ProfessionalsRepositoryPort,
} from '../ports/professionals-repository.port';
import { Bio, City, CompanyName, ProfessionalProfile } from '../../domain';
import type {
  CreateProfessionalProfileCommand,
  UpdateProfessionalProfileCommand,
} from '../commands/professionals.commands';

@Injectable()
export class ProfileService {
  constructor(
    @Inject(PROFESSIONALS_REPOSITORY_PORT)
    private readonly professionalsRepository: ProfessionalsRepositoryPort,
  ) {}

  async createProfile(
    requestUser: AuthUser,
    command: CreateProfessionalProfileCommand,
  ) {
    this.assertProfessionalRole(requestUser.role);

    const result = await this.professionalsRepository.createProfile({
      utilisateurId: requestUser.sub,
      biographie: Bio.create(command.bio)?.getValue() ?? null,
      nomEntreprise:
        CompanyName.create(command.companyName)?.getValue() ?? null,
      ville: City.create(command.city)?.getValue() ?? null,
    });

    if (result.status === 'already_exists') {
      throw appHttpException('PROFESSIONALS_PROFILE_ALREADY_EXISTS');
    }
    if (result.status === 'user_not_found') {
      throw appHttpException('AUTH_USER_NOT_FOUND');
    }

    return result.profile;
  }

  async getMyProfile(requestUser: AuthUser) {
    this.assertProfessionalRole(requestUser.role);
    const profile = await this.professionalsRepository.findByUserId(
      requestUser.sub,
    );
    if (!profile) {
      throw appHttpException('PROFESSIONALS_PROFILE_NOT_FOUND');
    }
    return profile;
  }

  async updateMyProfile(
    requestUser: AuthUser,
    command: UpdateProfessionalProfileCommand,
  ) {
    this.assertProfessionalRole(requestUser.role);

    if (
      command.bio === undefined &&
      command.companyName === undefined &&
      command.city === undefined
    ) {
      throw appHttpException('USERS_UPDATE_EMPTY');
    }

    const result = await this.professionalsRepository.updateProfile({
      utilisateurId: requestUser.sub,
      biographie: Bio.create(command.bio)?.getValue() ?? null,
      nomEntreprise:
        CompanyName.create(command.companyName)?.getValue() ?? null,
      ville: City.create(command.city)?.getValue() ?? null,
    });

    if (result.status === 'profile_not_found') {
      throw appHttpException('PROFESSIONALS_PROFILE_NOT_FOUND');
    }

    return result.profile;
  }

  async getProfessionalById(profileId: string) {
    const profile =
      await this.professionalsRepository.findVerifiedById(profileId);
    if (!profile) {
      throw appHttpException('PROFESSIONALS_PROFILE_NOT_FOUND');
    }
    return profile;
  }

  async listProfessionals(city?: string, limit: number = 20) {
    return this.professionalsRepository.listVerified({
      city: City.create(city)?.getValue() ?? undefined,
      limit,
    });
  }

  private assertProfessionalRole(role: AuthUser['role']): void {
    if (!ProfessionalProfile.isProfessionalRole(role)) {
      throw appHttpException('PROFESSIONALS_FORBIDDEN_ROLE');
    }
  }
}
