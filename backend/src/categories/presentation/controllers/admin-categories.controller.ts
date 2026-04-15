import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { RoleUtilisateur } from '@prisma/client';
import { CurrentUser } from '../../../auth/security/current-user.decorator';
import type { AuthUser } from '../../../auth/security/auth-user.type';
import { JwtAuthGuard } from '../../../auth/security/jwt-auth.guard';
import { appMessage } from '../../../core/http/app-http.exception';
import { createApiResponse } from '../../../shared/dto/api-response.dto';
import { Roles, RolesGuard } from '../../../shared/guards/roles.guard';
import { CategoriesFacade } from '../../application/services/categories-facade.service';
import { CreateCategoryDto } from '../dto/create-category.dto';
import { UpdateCategoryDto } from '../dto/update-category.dto';

@ApiTags('Admin - Categories')
@ApiBearerAuth()
@Controller('admin/categories')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AdminCategoriesController {
  constructor(private readonly categoriesFacade: CategoriesFacade) {}

  @Post()
  @Roles(RoleUtilisateur.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Creer une categorie' })
  @ApiResponse({ status: 201, description: 'Categorie creee avec succes' })
  @ApiResponse({
    status: 403,
    description: 'Acces reserve aux administrateurs',
  })
  async createCategory(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateCategoryDto,
  ) {
    const result = await this.categoriesFacade.createCategory(user, dto);
    return createApiResponse(
      result,
      appMessage('CATEGORIES_CATEGORY_CREATED').message,
    );
  }

  @Patch(':categoryId')
  @Roles(RoleUtilisateur.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Mettre a jour une categorie' })
  @ApiParam({ name: 'categoryId', description: 'Identifiant de la categorie' })
  @ApiResponse({
    status: 200,
    description: 'Categorie mise a jour avec succes',
  })
  async updateCategory(
    @CurrentUser() user: AuthUser,
    @Param('categoryId') categoryId: string,
    @Body() dto: UpdateCategoryDto,
  ) {
    const result = await this.categoriesFacade.updateCategory(
      user,
      categoryId,
      dto,
    );
    return createApiResponse(
      result,
      appMessage('CATEGORIES_CATEGORY_UPDATED').message,
    );
  }

  @Patch(':categoryId/disable')
  @Roles(RoleUtilisateur.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Desactiver une categorie' })
  @ApiParam({ name: 'categoryId', description: 'Identifiant de la categorie' })
  @ApiResponse({
    status: 200,
    description: 'Categorie desactivee avec succes',
  })
  async disableCategory(
    @CurrentUser() user: AuthUser,
    @Param('categoryId') categoryId: string,
  ) {
    const result = await this.categoriesFacade.disableCategory(
      user,
      categoryId,
    );
    return createApiResponse(
      result,
      appMessage('CATEGORIES_CATEGORY_DISABLED').message,
    );
  }
}
