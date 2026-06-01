import { Injectable } from '@nestjs/common';
import { appHttpException } from '../../../core/http/app-http.exception';
import type { AuthUser } from '../../../auth/security/auth-user.type';
import { Bio, City, CompanyName } from '../../domain';
import type {
  CreateProfessionalProfileCommand,
  UpdateProfessionalProfileCommand,
} from '../commands/professionals.commands';
import { ProfessionalAppService } from './professional-app-service.base';

@Injectable()
export class ProfileService extends ProfessionalAppService {
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
    return this.ensureProfessionalProfile(requestUser.sub);
  }

  async updateMyProfile(
    requestUser: AuthUser,
    command: UpdateProfessionalProfileCommand,
  ) {
    this.assertProfessionalRole(requestUser.role);
    this.assertNonEmptyUpdate(command as Record<string, unknown>);

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
      await this.professionalsRepository.findPublicById(profileId);
    if (!profile) {
      throw appHttpException('PROFESSIONALS_PROFILE_NOT_FOUND');
    }
    return profile;
  }
}
