import { Injectable } from '@nestjs/common';
import { appHttpException } from '../../../core/http/app-http.exception';
import type { AuthUser } from '../../../auth/security/auth-user.type';
import type { CreatePortfolioItemCommand } from '../commands/professionals.commands';
import { ProfessionalAppService } from './professional-app-service.base';

@Injectable()
export class PortfolioService extends ProfessionalAppService {
  async createItem(requestUser: AuthUser, command: CreatePortfolioItemCommand) {
    this.assertProfessionalRole(requestUser.role);

    const result = await this.professionalsRepository.createPortfolioItem({
      utilisateurId: requestUser.sub,
      title: command.title.trim(),
      description: command.description?.trim() ?? null,
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

    return { success: true };
  }

  async listByProfile(profileId: string) {
    await this.assertVerifiedProfile(profileId);
    return this.professionalsRepository.listPortfolio(profileId);
  }
}
