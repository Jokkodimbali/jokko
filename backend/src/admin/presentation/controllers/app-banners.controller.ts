import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
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
import { memoryStorage } from 'multer';
import {
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  IsUrl,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CurrentUser } from '../../../auth/security/current-user.decorator';
import type { AuthUser } from '../../../auth/security/auth-user.type';
import { JwtAuthGuard } from '../../../auth/security/jwt-auth.guard';
import { createApiResponse } from '../../../shared/dto/api-response.dto';
import { Roles, RolesGuard } from '../../../shared/guards/roles.guard';
import { AppBannerService } from '../../application/services/app-banner.service';
import { CloudinaryMediaService } from '../../../shared/media/cloudinary-media.service';
import { appHttpException } from '../../../core/http/app-http.exception';

type UploadedBannerImageFile = {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
};

const allowedBannerImageMimeTypes = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
]);

class AppBannerDto {
  @IsUrl() imageUrl!: string;
  @IsOptional() @IsUrl() redirectUrl?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
}
class ReplaceAppBannersDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AppBannerDto)
  banners!: AppBannerDto[];
}

@ApiTags('Bannieres application')
@Controller()
export class AppBannersController {
  constructor(
    private readonly banners: AppBannerService,
    private readonly cloudinaryMedia: CloudinaryMediaService,
  ) {}
  @Get('public/app-banners')
  @ApiOperation({ summary: 'Recuperer les bannieres publiques actives' })
  async listPublic() {
    return createApiResponse(
      await this.banners.listPublic(),
      'Bannieres recuperees.',
    );
  }
  @Get('admin/app-settings/banners')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RoleUtilisateur.ADMIN)
  async listAdmin(@CurrentUser() user: AuthUser) {
    return createApiResponse(
      await this.banners.listAdmin(user),
      'Bannieres recuperees.',
    );
  }
  @Post('admin/app-settings/banners')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RoleUtilisateur.ADMIN)
  @HttpCode(HttpStatus.OK)
  async replace(
    @CurrentUser() user: AuthUser,
    @Body() dto: ReplaceAppBannersDto,
  ) {
    return createApiResponse(
      await this.banners.replaceAll(user, dto.banners),
      'Bannieres enregistrees.',
    );
  }

  @Post('admin/app-settings/banners/image')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(RoleUtilisateur.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(
    FileInterceptor('image', {
      storage: memoryStorage(),
      limits: { fileSize: 2 * 1024 * 1024 },
      fileFilter: (_request, file, callback) => {
        callback(
          allowedBannerImageMimeTypes.has(file.mimetype)
            ? null
            : appHttpException('VALIDATION_REQUEST_INVALID'),
          allowedBannerImageMimeTypes.has(file.mimetype),
        );
      },
    }),
  )
  @ApiConsumes('multipart/form-data')
  @ApiOperation({ summary: 'Uploader une image de banniere' })
  async uploadImage(@UploadedFile() file: UploadedBannerImageFile | undefined) {
    if (!file) throw appHttpException('VALIDATION_REQUEST_INVALID');
    const uploaded = await this.cloudinaryMedia
      .upload({
        buffer: file.buffer,
        originalName: file.originalname || 'app-banner',
        mimeType: file.mimetype,
        folder: 'jokko/app-banners',
      })
      .catch(() => {
        throw appHttpException('VALIDATION_REQUEST_INVALID');
      });
    return createApiResponse(
      { imageUrl: uploaded.secureUrl },
      'Image de banniere telechargee.',
    );
  }
}
