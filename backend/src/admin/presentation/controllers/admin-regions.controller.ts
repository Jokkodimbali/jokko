import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RoleUtilisateur } from '@prisma/client';
import { CurrentUser } from '../../../auth/security/current-user.decorator';
import type { AuthUser } from '../../../auth/security/auth-user.type';
import { JwtAuthGuard } from '../../../auth/security/jwt-auth.guard';
import { appMessage } from '../../../core/http/app-http.exception';
import { API_DOCS } from '../../../core/messages/api-docs.messages';
import { createApiResponse } from '../../../shared/dto/api-response.dto';
import { Roles, RolesGuard } from '../../../shared/guards/roles.guard';
import { AdminRegionsService } from '../../application/services/admin-regions.service';

@ApiTags(API_DOCS.adminRegions.tag)
@ApiBearerAuth()
@Controller('admin/regions')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AdminRegionsController {
  constructor(private readonly adminRegionsService: AdminRegionsService) {}

  @Get()
  @Roles(RoleUtilisateur.ADMIN)
  @ApiOperation({ summary: API_DOCS.adminRegions.summary })
  async getRegions(@CurrentUser() user: AuthUser) {
    const result = await this.adminRegionsService.getRegions(user);
    return createApiResponse(
      result,
      appMessage('ADMIN_REGIONS_RETRIEVED').message,
    );
  }
}
