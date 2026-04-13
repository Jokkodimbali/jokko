import { Inject, Injectable } from '@nestjs/common';
import { RoleUtilisateur } from '@prisma/client';
import { appHttpException } from '../../../core/http/app-http.exception';
import type { AuthUser } from '../../../auth/security/auth-user.type';
import {
  PROFESSIONALS_REPOSITORY_PORT,
  type ProfessionalsRepositoryPort,
} from '../ports/professionals-repository.port';
import { KycIdCardUrl } from '../../domain';
import type {
  SubmitKycCommand,
  RejectKycCommand,
} from '../commands/professionals.commands';

@Injectable()
export class KycService {
  constructor(
    @Inject(PROFESSIONALS_REPOSITORY_PORT)
    private readonly professionalsRepository: ProfessionalsRepositoryPort,
  ) {}

  async submitKyc(requestUser: AuthUser, command: SubmitKycCommand) {
    this.assertProfessionalRole(requestUser.role);

    const result = await this.professionalsRepository.submitKyc({
      utilisateurId: requestUser.sub,
      idCardUrl: KycIdCardUrl.create(command.idCardUrl).getValue(),
    });

    if (result.status === 'profile_not_found') {
      throw appHttpException('PROFESSIONALS_PROFILE_NOT_FOUND');
    }

    return result.profile;
  }

  async approveKyc(requestUser: AuthUser, profileId: string) {
    this.assertAdminRole(requestUser.role);

    const profile = await this.professionalsRepository.approveKyc(profileId);
    if (!profile) {
      throw appHttpException('PROFESSIONALS_PROFILE_NOT_FOUND');
    }
    return profile;
  }

  async rejectKyc(
    requestUser: AuthUser,
    profileId: string,
    command: RejectKycCommand,
  ) {
    this.assertAdminRole(requestUser.role);

    const profile = await this.professionalsRepository.rejectKyc(
      profileId,
      command.reason.trim(),
    );
    if (!profile) {
      throw appHttpException('PROFESSIONALS_PROFILE_NOT_FOUND');
    }
    return profile;
  }

  private assertProfessionalRole(role: AuthUser['role']): void {
    if (role !== RoleUtilisateur.PRESTATAIRE) {
      throw appHttpException('PROFESSIONALS_FORBIDDEN_ROLE');
    }
  }

  private assertAdminRole(role: AuthUser['role']): void {
    if (role !== RoleUtilisateur.ADMIN) {
      throw appHttpException('PROFESSIONALS_ADMIN_FORBIDDEN_ROLE');
    }
  }
}
