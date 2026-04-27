import { Inject } from '@nestjs/common';
import { appHttpException } from '../../../core/http/app-http.exception';
import { Category } from '../../domain';
import {
  CATEGORIES_REPOSITORY_PORT,
  type CategoriesRepositoryPort,
} from '../ports/categories-repository.port';

export abstract class CategoryAppService {
  constructor(
    @Inject(CATEGORIES_REPOSITORY_PORT)
    protected readonly categoriesRepository: CategoriesRepositoryPort,
  ) {}

  protected assertAdminRole(role: string): void {
    if (!Category.isAdminRole(role)) {
      throw appHttpException('CATEGORIES_ADMIN_FORBIDDEN_ROLE');
    }
  }

  protected assertNonEmptyUpdate(command: Record<string, unknown>): void {
    const hasUpdate = Object.values(command).some(
      (value) => value !== undefined,
    );

    if (!hasUpdate) {
      throw appHttpException('CATEGORIES_UPDATE_EMPTY');
    }
  }
}
