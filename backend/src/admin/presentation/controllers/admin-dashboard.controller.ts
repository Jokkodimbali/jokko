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
import {
  ApiStandardErrorResponse,
  ApiStandardSuccessResponse,
} from '../../../shared/swagger/api-response-swagger.dto';
import { SWAGGER_RESPONSE_EXAMPLES } from '../../../shared/swagger/swagger-response.examples';
import { AdminDashboardService } from '../../application/services/admin-dashboard.service';

@ApiTags(API_DOCS.adminDashboard.tag)
@ApiBearerAuth()
@Controller('admin/dashboard')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AdminDashboardController {
  constructor(private readonly adminDashboardService: AdminDashboardService) {}

  @Get()
  @Roles(RoleUtilisateur.ADMIN)
  @ApiOperation({ summary: API_DOCS.adminDashboard.summary })
  @ApiStandardSuccessResponse({
    status: 200,
    description: API_DOCS.adminDashboard.success,
    messageExample: API_DOCS.adminDashboard.success,
    dataSchema: {
      type: 'object',
      example: SWAGGER_RESPONSE_EXAMPLES.adminDashboard.data,
    },
  })
  @ApiStandardErrorResponse({
    status: 403,
    description: API_DOCS.adminUsers.adminOnly,
    errorCode: 'USERS_ADMIN_FORBIDDEN_ROLE',
    messageExample: API_DOCS.adminUsers.adminOnly,
  })
  async getDashboard(@CurrentUser() user: AuthUser) {
    const result = await this.adminDashboardService.getDashboard(user);
    return createApiResponse(
      result,
      appMessage('ADMIN_DASHBOARD_RETRIEVED').message,
    );
  }
}
