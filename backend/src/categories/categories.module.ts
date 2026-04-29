import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { CATEGORIES_REPOSITORY_PORT } from './application/ports/categories-repository.port';
import { CategoryAdminService } from './application/services/category-admin.service';
import { CategoryQueryService } from './application/services/category-query.service';
import { CategoriesFacade } from './application/services/categories-facade.service';
import { CategoriesRepository } from './infrastructure/repositories/categories.repository';
import { AdminCategoriesController } from './presentation/controllers/admin-categories.controller';
import { CategoriesController } from './presentation/controllers/categories.controller';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [CategoriesController, AdminCategoriesController],
  providers: [
    CategoriesRepository,
    {
      provide: CATEGORIES_REPOSITORY_PORT,
      useExisting: CategoriesRepository,
    },
    CategoryQueryService,
    CategoryAdminService,
    CategoriesFacade,
  ],
  exports: [CategoriesFacade, CATEGORIES_REPOSITORY_PORT],
})
export class CategoriesModule {}
