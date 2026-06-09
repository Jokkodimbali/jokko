import { Inject, Injectable } from '@nestjs/common';
import {
  CATEGORIES_REPOSITORY_PORT,
  type CategoriesRepositoryPort,
} from '../ports/categories-repository.port';

@Injectable()
export class CategoryQueryService {
  constructor(
    @Inject(CATEGORIES_REPOSITORY_PORT)
    private readonly categoriesRepository: CategoriesRepositoryPort,
  ) {}

  async listActiveCategories(page?: number, limit?: number) {
    return this.categoriesRepository.listActive(page, limit);
  }

  async listActiveCategoryStructure() {
    return this.categoriesRepository.listActiveWithSubCategories();
  }
}
