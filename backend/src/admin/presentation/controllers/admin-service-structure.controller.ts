import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { RoleUtilisateur } from '@prisma/client';
import { diskStorage } from 'multer';
import type { DiskStorageCallback, DiskStorageFile } from 'multer';
import type { Request } from 'express';
import { extname, join } from 'node:path';
import { mkdirSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { CurrentUser } from '../../../auth/security/current-user.decorator';
import type { AuthUser } from '../../../auth/security/auth-user.type';
import { JwtAuthGuard } from '../../../auth/security/jwt-auth.guard';
import {
  appHttpException,
  appMessage,
} from '../../../core/http/app-http.exception';
import { createApiResponse } from '../../../shared/dto/api-response.dto';
import { buildPublicUploadUrl } from '../../../shared/http/public-upload-url';
import { Roles, RolesGuard } from '../../../shared/guards/roles.guard';
import { AdminServiceStructureService } from '../../application/services/admin-service-structure.service';
import { AssignServiceSubCategoriesDto } from '../dto/assign-service-subcategories.dto';
import { BulkCreateServiceCategoriesDto } from '../dto/bulk-create-service-categories.dto';
import { BulkCreateServiceSubCategoriesDto } from '../dto/bulk-create-service-subcategories.dto';
import { CreateServiceSubCategoryDto } from '../dto/create-service-subcategory.dto';

type UploadedServiceImageFile = {
  filename: string;
  mimetype: string;
  size: number;
};

const serviceImageUploadDirectory = join(
  process.cwd(),
  'uploads',
  'service-categories',
);
const allowedServiceImageMimeTypes = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/svg+xml',
]);

function ensureServiceImageUploadDirectory(): void {
  mkdirSync(serviceImageUploadDirectory, { recursive: true });
}

function buildServiceImageFileName(originalName: string): string {
  const extension = extname(originalName).toLowerCase() || '.png';
  const safeExtension = ['.jpg', '.jpeg', '.png', '.webp', '.svg'].includes(
    extension,
  )
    ? extension
    : '.png';
  return `service-category-${Date.now()}-${randomUUID()}${safeExtension}`;
}

@ApiTags('Admin - Structure des Services')
@ApiBearerAuth()
@Controller('admin/service-structure')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AdminServiceStructureController {
  constructor(
    private readonly serviceStructure: AdminServiceStructureService,
  ) {}

  @Get()
  @Roles(RoleUtilisateur.ADMIN)
  @ApiOperation({ summary: "Recuperer l'arborescence des services" })
  async getStructure(@CurrentUser() user: AuthUser) {
    const result = await this.serviceStructure.getStructure(user);
    return createApiResponse(
      result,
      appMessage('ADMIN_SERVICE_STRUCTURE_RETRIEVED').message,
    );
  }

  @Post('categories/bulk')
  @Roles(RoleUtilisateur.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Importer plusieurs categories de services' })
  async bulkCreateCategories(
    @CurrentUser() user: AuthUser,
    @Body() dto: BulkCreateServiceCategoriesDto,
  ) {
    const result = await this.serviceStructure.bulkCreateCategories(
      user,
      dto.categories,
    );
    return createApiResponse(
      result,
      appMessage('ADMIN_CATEGORIES_BULK_CREATED').message,
    );
  }

  @Post('subcategories')
  @Roles(RoleUtilisateur.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Creer une sous-categorie de services' })
  async createSubCategory(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateServiceSubCategoryDto,
  ) {
    const result = await this.serviceStructure.createSubCategory(user, dto);
    return createApiResponse(
      result,
      appMessage('ADMIN_SERVICE_SUBCATEGORY_CREATED').message,
    );
  }

  @Post('subcategories/bulk')
  @Roles(RoleUtilisateur.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Importer plusieurs sous-categories de services' })
  async bulkCreateSubCategories(
    @CurrentUser() user: AuthUser,
    @Body() dto: BulkCreateServiceSubCategoriesDto,
  ) {
    const result = await this.serviceStructure.bulkCreateSubCategories(
      user,
      dto.subCategories,
    );
    return createApiResponse(
      result,
      appMessage('ADMIN_SERVICE_SUBCATEGORIES_CREATED').message,
    );
  }

  @Patch('categories/:categoryId/subcategories')
  @Roles(RoleUtilisateur.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Affecter les sous-categories a une categorie' })
  async assignSubCategories(
    @CurrentUser() user: AuthUser,
    @Param('categoryId') categoryId: string,
    @Body() dto: AssignServiceSubCategoriesDto,
  ) {
    const result = await this.serviceStructure.assignSubCategories(
      user,
      categoryId,
      dto,
    );
    return createApiResponse(
      result,
      appMessage('ADMIN_SERVICE_SUBCATEGORIES_ASSIGNED').message,
    );
  }

  @Delete('categories/:categoryId')
  @Roles(RoleUtilisateur.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Supprimer definitivement une categorie vide',
  })
  async deleteEmptyCategory(
    @CurrentUser() user: AuthUser,
    @Param('categoryId') categoryId: string,
  ) {
    const result = await this.serviceStructure.deleteEmptyCategory(
      user,
      categoryId,
    );
    return createApiResponse(
      result,
      appMessage('ADMIN_SERVICE_CATEGORY_DELETED').message,
    );
  }

  @Delete('subcategories/:subCategoryId')
  @Roles(RoleUtilisateur.ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Supprimer definitivement une sous-categorie non affectee',
  })
  async deleteUnusedSubCategory(
    @CurrentUser() user: AuthUser,
    @Param('subCategoryId') subCategoryId: string,
  ) {
    const result = await this.serviceStructure.deleteUnusedSubCategory(
      user,
      subCategoryId,
    );
    return createApiResponse(
      result,
      appMessage('ADMIN_SERVICE_SUBCATEGORY_DELETED').message,
    );
  }

  @Post('images')
  @Roles(RoleUtilisateur.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(
    FileInterceptor('image', {
      storage: diskStorage({
        destination: (
          _request: unknown,
          _file: DiskStorageFile,
          callback: DiskStorageCallback,
        ) => {
          ensureServiceImageUploadDirectory();
          callback(null, serviceImageUploadDirectory);
        },
        filename: (
          _request: unknown,
          file: DiskStorageFile,
          callback: DiskStorageCallback,
        ) => {
          callback(null, buildServiceImageFileName(file.originalname));
        },
      }),
      limits: { fileSize: 2 * 1024 * 1024 },
      fileFilter: (_request, file, callback) => {
        if (!allowedServiceImageMimeTypes.has(file.mimetype)) {
          callback(appHttpException('VALIDATION_REQUEST_INVALID'), false);
          return;
        }
        callback(null, true);
      },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Uploader une image de categorie' })
  async uploadCategoryImage(
    @UploadedFile() file: UploadedServiceImageFile | undefined,
    @Req() request: Request,
  ) {
    if (!file) {
      throw appHttpException('VALIDATION_REQUEST_INVALID');
    }

    const imageUrl = buildPublicUploadUrl(
      request,
      `/uploads/service-categories/${file.filename}`,
    );
    return createApiResponse(
      { imageUrl },
      appMessage('ADMIN_SERVICE_IMAGE_UPLOADED').message,
    );
  }
}
