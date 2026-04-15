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

  async listActiveCategories() {
    return this.categoriesRepository.listActive();
  }
}
