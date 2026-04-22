import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../../auth/security/current-user.decorator';
import type { AuthUser } from '../../../auth/security/auth-user.type';
import { JwtAuthGuard } from '../../../auth/security/jwt-auth.guard';
import { appMessage } from '../../../core/http/app-http.exception';
import { API_DOCS } from '../../../core/messages/api-docs.messages';
import { createApiResponse } from '../../../shared/dto/api-response.dto';
import { NotificationsService } from '../../application/services/notifications.service';
import { ListNotificationsQueryDto } from '../dto/list-notifications-query.dto';
import { UpdateFcmTokenDto } from '../dto/update-fcm-token.dto';

@ApiTags(API_DOCS.notifications.tag)
@ApiBearerAuth()
@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  @ApiOperation({ summary: API_DOCS.notifications.listSummary })
  @ApiResponse({
    status: 200,
    description: API_DOCS.notifications.listSuccess,
  })
  async listMine(
    @CurrentUser() user: AuthUser,
    @Query() query: ListNotificationsQueryDto,
  ) {
    const result = await this.notificationsService.listForUser({
      userId: user.sub,
      isRead: query.read,
      limit: query.limit,
      offset: query.offset,
    });

    return createApiResponse(result);
  }

  @Patch('read-all')
  @ApiOperation({ summary: API_DOCS.notifications.markAllAsReadSummary })
  @ApiResponse({
    status: 200,
    description: appMessage('NOTIFICATIONS_ALL_MARKED_AS_READ').message,
  })
  async markAllAsRead(@CurrentUser() user: AuthUser) {
    const result = await this.notificationsService.markAllAsRead(user.sub);
    return createApiResponse(
      result,
      appMessage('NOTIFICATIONS_ALL_MARKED_AS_READ').message,
    );
  }

  @Patch(':id/read')
  @ApiOperation({ summary: API_DOCS.notifications.markAsReadSummary })
  @ApiParam({
    name: 'id',
    description: API_DOCS.notifications.notificationIdParam,
  })
  @ApiResponse({
    status: 200,
    description: appMessage('NOTIFICATIONS_MARKED_AS_READ').message,
  })
  async markAsRead(@CurrentUser() user: AuthUser, @Param('id') id: string) {
    const result = await this.notificationsService.markAsRead(id, user.sub);
    return createApiResponse(
      result,
      appMessage('NOTIFICATIONS_MARKED_AS_READ').message,
    );
  }

  @Post('device-token')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: API_DOCS.notifications.updateFcmTokenSummary })
  @ApiResponse({
    status: 200,
    description: appMessage('NOTIFICATIONS_FCM_TOKEN_UPDATED').message,
  })
  async updateFcmToken(
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateFcmTokenDto,
  ) {
    await this.notificationsService.updateFcmToken(user.sub, dto.fcmToken);
    return createApiResponse(
      null,
      appMessage('NOTIFICATIONS_FCM_TOKEN_UPDATED').message,
    );
  }
}
