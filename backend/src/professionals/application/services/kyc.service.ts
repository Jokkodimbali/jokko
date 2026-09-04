import { Inject, Injectable } from '@nestjs/common';
import { appHttpException } from '../../../core/http/app-http.exception';
import { NotificationsService } from '../../../notifications/application/services/notifications.service';
import { NOTIFICATION_TYPES } from '../../../notifications/domain/entities/notification.entity';
import type { AuthUser } from '../../../auth/security/auth-user.type';
import { KycIdCardUrl, KycIdCardUrlVerso } from '../../domain';
import {
  PROFESSIONALS_REPOSITORY_PORT,
  type KycStatus,
  type ProfessionalsRepositoryPort,
} from '../ports/professionals-repository.port';
import type {
  SubmitKycCommand,
  RejectKycCommand,
} from '../commands/professionals.commands';
import { ProfessionalAppService } from './professional-app-service.base';

@Injectable()
export class KycService extends ProfessionalAppService {
  constructor(
    @Inject(PROFESSIONALS_REPOSITORY_PORT)
    professionalsRepository: ProfessionalsRepositoryPort,
    private readonly notificationsService: NotificationsService,
  ) {
    super(professionalsRepository);
  }
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
    await this.notificationsService.createInAppNotification({
      userId: result.profile.utilisateur.id,
      type: NOTIFICATION_TYPES.KYC_APPROUVEE,
      title: 'Profil professionnel validé',
      body: 'Votre profil professionnel a été approuvé. Vous pouvez désormais proposer vos services.',
      data: { professionalId: result.profile.id, route: '/settings' },
    });
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
    await this.notificationsService.createInAppNotification({
      userId: result.profile.utilisateur.id,
      type: NOTIFICATION_TYPES.KYC_REJETEE,
      title: 'Profil professionnel à corriger',
      body: `Votre vérification a été refusée. Motif : ${reason}`,
      data: { professionalId: result.profile.id, reason, route: '/settings' },
    });
    return result.profile;
  }
}
