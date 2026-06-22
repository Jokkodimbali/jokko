import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RoleUtilisateur } from '@prisma/client';
import { CurrentUser } from '../../../auth/security/current-user.decorator';
import type { AuthUser } from '../../../auth/security/auth-user.type';
import { JwtAuthGuard } from '../../../auth/security/jwt-auth.guard';
import { appMessage } from '../../../core/http/app-http.exception';
import { API_DOCS } from '../../../core/messages/api-docs.messages';
import { createApiResponse } from '../../../shared/dto/api-response.dto';
import { Roles, RolesGuard } from '../../../shared/guards/roles.guard';
import {
  ApiStandardErrorResponse,
  ApiStandardSuccessResponse,
} from '../../../shared/swagger/api-response-swagger.dto';
import { AdminRevenueService } from '../../application/services/admin-revenue.service';
import { AdminRevenueQueryDto } from '../dto/admin-revenue-query.dto';

@ApiTags(API_DOCS.adminRevenue.tag)
@ApiBearerAuth()
@Controller('admin/revenue')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AdminRevenueController {
  constructor(private readonly adminRevenueService: AdminRevenueService) {}

  @Get()
  @Roles(RoleUtilisateur.ADMIN)
  @ApiOperation({ summary: API_DOCS.adminRevenue.summary })
  @ApiStandardSuccessResponse({
    status: 200,
    description: API_DOCS.adminRevenue.success,
    messageExample: API_DOCS.adminRevenue.success,
  })
  @ApiStandardErrorResponse({
    status: 403,
    description: API_DOCS.adminUsers.adminOnly,
    errorCode: 'USERS_ADMIN_FORBIDDEN_ROLE',
    messageExample: API_DOCS.adminUsers.adminOnly,
  })
  async getRevenue(
    @CurrentUser() user: AuthUser,
    @Query() query: AdminRevenueQueryDto,
  ) {
    const result = await this.adminRevenueService.getRevenue(
      user,
      query.period,
    );
    return createApiResponse(
      result,
      appMessage('ADMIN_REVENUE_RETRIEVED').message,
    );
  }
}
