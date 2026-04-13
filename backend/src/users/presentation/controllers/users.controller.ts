import {
  Body,
  Controller,
  Delete,
  Get,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { appMessage } from '../../../core/http/app-http.exception';
import { CurrentUser } from '../../../auth/security/current-user.decorator';
import type { AuthUser } from '../../../auth/security/auth-user.type';
import { JwtAuthGuard } from '../../../auth/security/jwt-auth.guard';
import { UsersService } from '../../application/services/users.service';
import { UpdateMyProfileDto } from '../dto/update-my-profile.dto';
import { UpdateMyAvatarDto } from '../dto/update-my-avatar.dto';
import { MyHistoryQueryDto } from '../dto/my-history-query.dto';
import { createApiResponse } from '../../../shared/dto/api-response.dto';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async me(@CurrentUser() user: AuthUser) {
    const result = await this.usersService.me(user.sub);
    return createApiResponse(result);
  }

  @Put('me')
  @UseGuards(JwtAuthGuard)
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
  async myHistory(
    @CurrentUser() user: AuthUser,
    @Query() query: MyHistoryQueryDto,
  ) {
    const result = await this.usersService.getMyHistory(user.sub, query);
    return createApiResponse(result);
  }

  @Delete('me')
  @UseGuards(JwtAuthGuard)
  async deleteMe(@CurrentUser() user: AuthUser) {
    await this.usersService.anonymizeMe(user.sub);
    return createApiResponse(
      null,
      appMessage('USERS_ACCOUNT_ANONYMIZED').message,
    );
  }
}
