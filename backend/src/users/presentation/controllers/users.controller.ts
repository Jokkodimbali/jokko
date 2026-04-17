import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { appMessage } from '../../../core/http/app-http.exception';
import { CurrentUser } from '../../../auth/security/current-user.decorator';
import type { AuthUser } from '../../../auth/security/auth-user.type';
import { JwtAuthGuard } from '../../../auth/security/jwt-auth.guard';
import { UsersService } from '../../application/services/users.service';
import { UpdateMyProfileDto } from '../dto/update-my-profile.dto';
import { UpdateMyAvatarDto } from '../dto/update-my-avatar.dto';
import { MyHistoryQueryDto } from '../dto/my-history-query.dto';
import { createApiResponse } from '../../../shared/dto/api-response.dto';
import { API_DOCS } from '../../../core/messages/api-docs.messages';

@ApiTags(API_DOCS.users.tag)
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: API_DOCS.users.meSummary })
  @ApiResponse({ status: 200, description: API_DOCS.common.profileRetrieved })
  @ApiResponse({ status: 401, description: API_DOCS.common.unauthorized })
  async me(@CurrentUser() user: AuthUser) {
    const result = await this.usersService.me(user.sub);
    return createApiResponse(result);
  }

  @Patch('me')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: API_DOCS.users.updateSummary })
  @ApiResponse({
    status: 200,
    description: appMessage('USERS_PROFILE_UPDATED').message,
  })
  @ApiResponse({
    status: 400,
    description: API_DOCS.users.updateBadRequest,
  })
  @ApiResponse({ status: 409, description: API_DOCS.users.updateConflict })
  async updateMe(
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateMyProfileDto,
  ) {
    const result = await this.usersService.updateMe(user.sub, dto);
    return createApiResponse(
      result,
      appMessage('USERS_PROFILE_UPDATED').message,
    );
  }

  @Post('me/avatar')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: API_DOCS.users.avatarSummary })
  @ApiResponse({
    status: 201,
    description: appMessage('USERS_AVATAR_UPDATED').message,
  })
  @ApiResponse({ status: 400, description: API_DOCS.users.avatarBadRequest })
  async updateMyAvatar(
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdateMyAvatarDto,
  ) {
    const result = await this.usersService.updateMyAvatar(user.sub, dto);
    return createApiResponse(
      result,
      appMessage('USERS_AVATAR_UPDATED').message,
    );
  }

  @Get('me/history')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: API_DOCS.users.historySummary })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: API_DOCS.users.historyLimitDescription,
  })
  @ApiResponse({ status: 200, description: API_DOCS.users.historySuccess })
  async myHistory(
    @CurrentUser() user: AuthUser,
    @Query() query: MyHistoryQueryDto,
  ) {
    const result = await this.usersService.getMyHistory(user.sub, query);
    return createApiResponse(result);
  }

  @Delete('me')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: API_DOCS.users.deleteSummary })
  @ApiResponse({
    status: 200,
    description: appMessage('USERS_ACCOUNT_ANONYMIZED').message,
  })
  @ApiResponse({ status: 401, description: API_DOCS.common.unauthorized })
  async deleteMe(@CurrentUser() user: AuthUser) {
    await this.usersService.anonymizeMe(user.sub);
    return createApiResponse(
      null,
      appMessage('USERS_ACCOUNT_ANONYMIZED').message,
    );
  }
}
