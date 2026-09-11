import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Put,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { IsNumber, Max, Min } from 'class-validator';
import { RoleUtilisateur } from '@prisma/client';
import { CurrentUser } from '../../../auth/security/current-user.decorator';
import type { AuthUser } from '../../../auth/security/auth-user.type';
import { JwtAuthGuard } from '../../../auth/security/jwt-auth.guard';
import { createApiResponse } from '../../../shared/dto/api-response.dto';
import { Roles, RolesGuard } from '../../../shared/guards/roles.guard';
import { DeliveryPricingSettingsService } from '../../../maps/application/delivery-pricing-settings.service';

class UpdateDeliveryPricingDto {
  @IsNumber() @Min(0) pricePerKm!: number;
  @IsNumber() @Min(0) @Max(100) courierCommissionRate!: number;
}

@ApiTags('Admin - Tarification livraison')
@ApiBearerAuth()
@Controller('admin/app-settings/delivery-pricing')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AdminDeliveryPricingController {
  constructor(private readonly settings: DeliveryPricingSettingsService) {}

  @Get()
  @Roles(RoleUtilisateur.ADMIN)
  async get() {
    return createApiResponse(
      await this.settings.get(),
      'Tarification de livraison récupérée.',
    );
  }

  @Put()
  @Roles(RoleUtilisateur.ADMIN)
  @HttpCode(HttpStatus.OK)
  async update(@Body() dto: UpdateDeliveryPricingDto) {
    return createApiResponse(
      await this.settings.update(dto),
      'Tarification de livraison enregistrée.',
    );
  }
}
