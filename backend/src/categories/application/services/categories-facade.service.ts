import { Injectable } from '@nestjs/common';
import type { AuthUser } from '../../../auth/security/auth-user.type';
import type {
  CreateCategoryCommand,
  UpdateCategoryCommand,
} from '../commands/categories.commands';
import { CategoryAdminService } from './category-admin.service';
import { CategoryQueryService } from './category-query.service';

@Injectable()
export class CategoriesFacade {
  constructor(
    private readonly categoryQueryService: CategoryQueryService,
    private readonly categoryAdminService: CategoryAdminService,
  ) {}

  async listActiveCategories() {
    return this.categoryQueryService.listActiveCategories();
  }

  async createCategory(requestUser: AuthUser, command: CreateCategoryCommand) {
    return this.categoryAdminService.createCategory(requestUser, command);
  }

  async updateCategory(
    requestUser: AuthUser,
    categoryId: string,
    command: UpdateCategoryCommand,
  ) {
    return this.categoryAdminService.updateCategory(
      requestUser,
      categoryId,
      command,
    );
  }

  async disableCategory(requestUser: AuthUser, categoryId: string) {
    return this.categoryAdminService.disableCategory(requestUser, categoryId);
  }
}
