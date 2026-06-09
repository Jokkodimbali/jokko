import { Injectable } from '@nestjs/common';
import { appHttpException } from '../../../core/http/app-http.exception';
import type { AuthUser } from '../../../auth/security/auth-user.type';
import {
  Category,
  CategoryIconUrl,
  CategoryName,
  CategorySortOrder,
} from '../../domain';
import type {
  CreateCategoryCommand,
  UpdateCategoryCommand,
} from '../commands/categories.commands';
import { CategoryAppService } from './category-app-service.base';

const normalizeCommissionRate = (commissionRate?: number): number => {
  if (commissionRate === undefined) {
    return 10;
  }

  if (
    !Number.isFinite(commissionRate) ||
    commissionRate < 0 ||
    commissionRate > 100
  ) {
    throw appHttpException('CATEGORIES_COMMISSION_RATE_INVALID');
  }

  return Number(commissionRate.toFixed(2));
};

@Injectable()
export class CategoryAdminService extends CategoryAppService {
  async createCategory(requestUser: AuthUser, command: CreateCategoryCommand) {
    this.assertAdminRole(requestUser.role);

    const categoryName = CategoryName.create(command.name)?.getValue();
    if (!categoryName) {
      throw appHttpException('VALIDATION_REQUEST_INVALID');
    }

    const iconUrl = CategoryIconUrl.create(command.iconUrl)?.getValue() ?? null;
    const sortOrder =
      CategorySortOrder.create(command.sortOrder)?.getValue() ?? 0;
    const commissionRate = normalizeCommissionRate(command.commissionRate);

    const existingCategory =
      await this.categoriesRepository.findByName(categoryName);
    if (existingCategory) {
      throw appHttpException('CATEGORIES_NAME_ALREADY_USED');
    }

    const result = await this.categoriesRepository.create({
      name: categoryName,
      iconUrl,
      sortOrder,
      commissionRate,
    });

    if (result.status === 'name_conflict') {
      throw appHttpException('CATEGORIES_NAME_ALREADY_USED');
    }

    return result.category;
  }

  async updateCategory(
    requestUser: AuthUser,
    categoryId: string,
    command: UpdateCategoryCommand,
  ) {
    this.assertAdminRole(requestUser.role);
    this.assertNonEmptyUpdate(command as Record<string, unknown>);

    const existingCategory =
      await this.categoriesRepository.findById(categoryId);
    if (!existingCategory) {
      throw appHttpException('CATEGORIES_CATEGORY_NOT_FOUND');
    }

    const category = Category.reconstitute({
      id: existingCategory.id,
      name: existingCategory.nom,
      iconUrl: existingCategory.urlIcone,
      sortOrder: existingCategory.ordreTri,
      commissionRate: existingCategory.tauxCommission,
      isActive: existingCategory.estActive,
    });

    const nextName = CategoryName.create(command.name)?.getValue();
    const nextIconUrl =
      command.iconUrl === undefined
        ? undefined
        : (CategoryIconUrl.create(command.iconUrl)?.getValue() ?? null);
    const nextSortOrder =
      command.sortOrder === undefined
        ? undefined
        : (CategorySortOrder.create(command.sortOrder)?.getValue() ?? 0);
    const nextCommissionRate =
      command.commissionRate === undefined
        ? undefined
        : normalizeCommissionRate(command.commissionRate);

    if (
      nextName &&
      nextName.toLowerCase() !== existingCategory.nom.toLowerCase()
    ) {
      const categoryWithSameName =
        await this.categoriesRepository.findByName(nextName);
      if (categoryWithSameName && categoryWithSameName.id !== categoryId) {
        throw appHttpException('CATEGORIES_NAME_ALREADY_USED');
      }
    }

    category.updateDetails({
      name: nextName,
      iconUrl: nextIconUrl,
      sortOrder: nextSortOrder,
      commissionRate: nextCommissionRate,
    });

    const result = await this.categoriesRepository.update({
      categoryId,
      name: category.name,
      iconUrl: category.iconUrl,
      sortOrder: category.sortOrder,
      commissionRate: category.commissionRate,
    });

    if (result.status === 'not_found') {
      throw appHttpException('CATEGORIES_CATEGORY_NOT_FOUND');
    }

    if (result.status === 'name_conflict') {
      throw appHttpException('CATEGORIES_NAME_ALREADY_USED');
    }

    return result.category;
  }

  async disableCategory(requestUser: AuthUser, categoryId: string) {
    this.assertAdminRole(requestUser.role);

    const existingCategory =
      await this.categoriesRepository.findById(categoryId);
    if (!existingCategory) {
      throw appHttpException('CATEGORIES_CATEGORY_NOT_FOUND');
    }

    const category = Category.reconstitute({
      id: existingCategory.id,
      name: existingCategory.nom,
      iconUrl: existingCategory.urlIcone,
      sortOrder: existingCategory.ordreTri,
      commissionRate: existingCategory.tauxCommission,
      isActive: existingCategory.estActive,
    });
    category.disable();

    const result = await this.categoriesRepository.disable(categoryId);
    if (result.status === 'not_found') {
      throw appHttpException('CATEGORIES_CATEGORY_NOT_FOUND');
    }

    return result.category;
  }

  async activateCategory(requestUser: AuthUser, categoryId: string) {
    this.assertAdminRole(requestUser.role);

    const existingCategory =
      await this.categoriesRepository.findById(categoryId);
    if (!existingCategory) {
      throw appHttpException('CATEGORIES_CATEGORY_NOT_FOUND');
    }

    const category = Category.reconstitute({
      id: existingCategory.id,
      name: existingCategory.nom,
      iconUrl: existingCategory.urlIcone,
      sortOrder: existingCategory.ordreTri,
      commissionRate: existingCategory.tauxCommission,
      isActive: existingCategory.estActive,
    });
    category.activate();

    const result = await this.categoriesRepository.activate(categoryId);
    if (result.status === 'not_found') {
      throw appHttpException('CATEGORIES_CATEGORY_NOT_FOUND');
    }

    return result.category;
  }
}
