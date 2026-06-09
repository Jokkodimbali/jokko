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
import { API_DOCS } from '../../../core/messages/api-docs.messages';
import {
  ApiStandardErrorResponse,
  ApiStandardSuccessResponse,
} from '../../../shared/swagger/api-response-swagger.dto';
import { SWAGGER_RESPONSE_EXAMPLES } from '../../../shared/swagger/swagger-response.examples';

@ApiTags(API_DOCS.adminCategories.tag)
@ApiBearerAuth()
@Controller('admin/categories')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AdminCategoriesController {
  constructor(private readonly categoriesFacade: CategoriesFacade) {}

  @Post()
  @Roles(RoleUtilisateur.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: API_DOCS.adminCategories.createSummary })
  @ApiStandardSuccessResponse({
    status: 201,
    description: appMessage('CATEGORIES_CATEGORY_CREATED').message,
    messageExample: appMessage('CATEGORIES_CATEGORY_CREATED').message,
    dataSchema: {
      type: 'object',
      example: SWAGGER_RESPONSE_EXAMPLES.categories.detailData,
    },
  })
  @ApiStandardErrorResponse({
    status: 403,
    description: API_DOCS.adminCategories.adminOnly,
    errorCode: 'CATEGORIES_ADMIN_FORBIDDEN_ROLE',
    messageExample: API_DOCS.adminCategories.adminOnly,
  })
  @ApiStandardErrorResponse({
    status: 409,
    description: appMessage('CATEGORIES_NAME_ALREADY_USED').message,
    errorCode: 'CATEGORIES_NAME_ALREADY_USED',
    messageExample: appMessage('CATEGORIES_NAME_ALREADY_USED').message,
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
  @ApiOperation({ summary: API_DOCS.adminCategories.updateSummary })
  @ApiParam({
    name: 'categoryId',
    description: API_DOCS.adminCategories.categoryIdParam,
  })
  @ApiStandardSuccessResponse({
    status: 200,
    description: appMessage('CATEGORIES_CATEGORY_UPDATED').message,
    messageExample: appMessage('CATEGORIES_CATEGORY_UPDATED').message,
    dataSchema: {
      type: 'object',
      example: SWAGGER_RESPONSE_EXAMPLES.categories.detailData,
    },
  })
  @ApiStandardErrorResponse({
    status: 404,
    description: appMessage('CATEGORIES_CATEGORY_NOT_FOUND').message,
    errorCode: 'CATEGORIES_CATEGORY_NOT_FOUND',
    messageExample: appMessage('CATEGORIES_CATEGORY_NOT_FOUND').message,
  })
  @ApiStandardErrorResponse({
    status: 409,
    description: appMessage('CATEGORIES_NAME_ALREADY_USED').message,
    errorCode: 'CATEGORIES_NAME_ALREADY_USED',
    messageExample: appMessage('CATEGORIES_NAME_ALREADY_USED').message,
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
  @ApiOperation({ summary: API_DOCS.adminCategories.disableSummary })
  @ApiParam({
    name: 'categoryId',
    description: API_DOCS.adminCategories.categoryIdParam,
  })
  @ApiStandardSuccessResponse({
    status: 200,
    description: appMessage('CATEGORIES_CATEGORY_DISABLED').message,
    messageExample: appMessage('CATEGORIES_CATEGORY_DISABLED').message,
    dataSchema: {
      type: 'object',
      example: {
        ...SWAGGER_RESPONSE_EXAMPLES.categories.detailData,
        estActive: false,
      },
    },
  })
  @ApiStandardErrorResponse({
    status: 404,
    description: appMessage('CATEGORIES_CATEGORY_NOT_FOUND').message,
    errorCode: 'CATEGORIES_CATEGORY_NOT_FOUND',
    messageExample: appMessage('CATEGORIES_CATEGORY_NOT_FOUND').message,
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

  @Patch(':categoryId/activate')
  @Roles(RoleUtilisateur.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: API_DOCS.adminCategories.activateSummary })
  @ApiParam({
    name: 'categoryId',
    description: API_DOCS.adminCategories.categoryIdParam,
  })
  @ApiStandardSuccessResponse({
    status: 200,
    description: appMessage('CATEGORIES_CATEGORY_ACTIVATED').message,
    messageExample: appMessage('CATEGORIES_CATEGORY_ACTIVATED').message,
    dataSchema: {
      type: 'object',
      example: {
        ...SWAGGER_RESPONSE_EXAMPLES.categories.detailData,
        estActive: true,
      },
    },
  })
  @ApiStandardErrorResponse({
    status: 404,
    description: appMessage('CATEGORIES_CATEGORY_NOT_FOUND').message,
    errorCode: 'CATEGORIES_CATEGORY_NOT_FOUND',
    messageExample: appMessage('CATEGORIES_CATEGORY_NOT_FOUND').message,
  })
  async activateCategory(
    @CurrentUser() user: AuthUser,
    @Param('categoryId') categoryId: string,
  ) {
    const result = await this.categoriesFacade.activateCategory(
      user,
      categoryId,
    );
    return createApiResponse(
      result,
      appMessage('CATEGORIES_CATEGORY_ACTIVATED').message,
    );
  }
}
