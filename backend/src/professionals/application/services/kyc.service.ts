import { Injectable } from '@nestjs/common';
import { appHttpException } from '../../../core/http/app-http.exception';
import type { AuthUser } from '../../../auth/security/auth-user.type';
import { KycIdCardUrl, KycIdCardUrlVerso } from '../../domain';
import type { KycStatus } from '../ports/professionals-repository.port';
import type {
  SubmitKycCommand,
  RejectKycCommand,
} from '../commands/professionals.commands';
import { ProfessionalAppService } from './professional-app-service.base';

@Injectable()
export class KycService extends ProfessionalAppService {
  async listKycForAdmin(
    requestUser: AuthUser,
    query?: {
      status?: KycStatus;
      limit?: number;
      offset?: number;
      search?: string;
    },
  ) {
    this.assertAdminRole(requestUser.role);
    const [items, total] = await Promise.all([
      this.professionalsRepository.listKycForAdmin(query),
      this.professionalsRepository.countKycForAdmin(query),
    ]);
    return {
      items,
      total,
      limit: query?.limit ?? 20,
      offset: query?.offset ?? 0,
    };
  }

  async getKycByIdForAdmin(requestUser: AuthUser, profileId: string) {
    this.assertAdminRole(requestUser.role);
    const profile =
      await this.professionalsRepository.findKycByIdForAdmin(profileId);
    if (!profile) {
      throw appHttpException('PROFESSIONALS_PROFILE_NOT_FOUND');
    }
    return profile;
  }

  async submitKyc(requestUser: AuthUser, command: SubmitKycCommand) {
    this.assertProfessionalRole(requestUser.role);

    const result = await this.professionalsRepository.submitKyc({
      utilisateurId: requestUser.sub,
      idCardUrlRecto: KycIdCardUrl.create(command.idCardUrl).getValue(),
      idCardUrlVerso: command.idCardUrlVerso
        ? KycIdCardUrlVerso.create(command.idCardUrlVerso).getValue()
        : null,
    });

    if (result.status === 'profile_not_found') {
      throw appHttpException('PROFESSIONALS_PROFILE_NOT_FOUND');
    }

    return result.profile;
  }

  async approveKyc(requestUser: AuthUser, profileId: string) {
    this.assertAdminRole(requestUser.role);

    const result = await this.professionalsRepository.approveKyc(profileId);
    if (result.status === 'profile_not_found') {
      throw appHttpException('PROFESSIONALS_PROFILE_NOT_FOUND');
    }
    return result.profile;
  }

  async rejectKyc(
    requestUser: AuthUser,
    profileId: string,
    command: RejectKycCommand,
  ) {
    this.assertAdminRole(requestUser.role);

    const reason = command.reason.trim();
    if (reason.length === 0) {
      throw appHttpException('PROFESSIONALS_REJECT_REASON_EMPTY');
    }

    const result = await this.professionalsRepository.rejectKyc(
      profileId,
      reason,
    );
    if (result.status === 'profile_not_found') {
      throw appHttpException('PROFESSIONALS_PROFILE_NOT_FOUND');
    }
    return result.profile;
  }
}
