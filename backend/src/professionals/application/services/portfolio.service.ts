import { Inject, Injectable } from '@nestjs/common';
import { appHttpException } from '../../../core/http/app-http.exception';
import type { AuthUser } from '../../../auth/security/auth-user.type';
import {
  PROFESSIONALS_REPOSITORY_PORT,
  type ProfessionalsRepositoryPort,
} from '../ports/professionals-repository.port';
import { ProfessionalProfile } from '../../domain';
import type { CreatePortfolioItemCommand } from '../commands/professionals.commands';

@Injectable()
export class PortfolioService {
  constructor(
    @Inject(PROFESSIONALS_REPOSITORY_PORT)
    private readonly professionalsRepository: ProfessionalsRepositoryPort,
  ) {}

  async createItem(requestUser: AuthUser, command: CreatePortfolioItemCommand) {
    this.assertProfessionalRole(requestUser.role);

    const result = await this.professionalsRepository.createPortfolioItem({
      utilisateurId: requestUser.sub,
      title: command.title.trim(),
      description: command.description?.trim(),
      imageUrl: command.imageUrl.trim(),
    });

    if (result.status === 'profile_not_found') {
      throw appHttpException('PROFESSIONALS_PROFILE_NOT_FOUND');
    }
    return result.item;
  }

  async deleteItem(requestUser: AuthUser, itemId: string) {
    this.assertProfessionalRole(requestUser.role);

    const result = await this.professionalsRepository.deletePortfolioItem(
      requestUser.sub,
      itemId,
    );
    if (result.status === 'profile_not_found') {
      throw appHttpException('PROFESSIONALS_PROFILE_NOT_FOUND');
    }
    if (result.status === 'item_not_found') {
      throw appHttpException('PROFESSIONALS_PORTFOLIO_ITEM_NOT_FOUND');
    }
  }

  async listByProfile(profileId: string) {
    await this.ensureVerifiedProfile(profileId);
    return this.professionalsRepository.listPortfolio(profileId);
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
}
