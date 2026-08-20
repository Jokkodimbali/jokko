import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RoleUtilisateur } from '@prisma/client';
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
  constructor(private readonly banners: AppBannerService) {}
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
}
