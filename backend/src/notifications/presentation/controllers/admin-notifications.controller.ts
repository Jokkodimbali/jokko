import { Body, Controller, Post, UseGuards } from '@nestjs/common';
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
import { NotificationsService } from '../../application/services/notifications.service';
import { BroadcastNotificationDto } from '../dto/broadcast-notification.dto';

@ApiTags(API_DOCS.adminNotifications.tag)
@ApiBearerAuth()
@Controller('admin/notifications')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AdminNotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Post('broadcast')
  @Roles(RoleUtilisateur.ADMIN)
  @ApiOperation({ summary: API_DOCS.adminNotifications.broadcastSummary })
  @ApiStandardSuccessResponse({
    status: 201,
    description: API_DOCS.adminNotifications.broadcastSuccess,
    messageExample: API_DOCS.adminNotifications.broadcastSuccess,
    dataSchema: {
      type: 'object',
      example: SWAGGER_RESPONSE_EXAMPLES.notifications.adminBroadcastData,
    },
  })
  @ApiStandardErrorResponse({
    status: 403,
    description: API_DOCS.adminNotifications.adminOnly,
    errorCode: 'USERS_ADMIN_FORBIDDEN_ROLE',
    messageExample: API_DOCS.adminNotifications.adminOnly,
  })
  async broadcast(
    @CurrentUser() user: AuthUser,
    @Body() dto: BroadcastNotificationDto,
  ) {
    const result = await this.notificationsService.broadcastByAdmin({
      role: user.role,
      target: dto.target,
      title: dto.title,
      body: dto.body,
      data: dto.data,
    });

    return createApiResponse(
      result,
      appMessage('NOTIFICATIONS_ADMIN_BROADCAST_SENT').message,
    );
  }
}
