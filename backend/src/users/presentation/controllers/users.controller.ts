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

@ApiTags('Users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get my user profile' })
  @ApiResponse({ status: 200, description: 'Profile retrieved successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async me(@CurrentUser() user: AuthUser) {
    const result = await this.usersService.me(user.sub);
    return createApiResponse(result);
  }

  @Patch('me')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Update my user profile (partial update)' })
  @ApiResponse({ status: 200, description: 'Profile updated successfully' })
  @ApiResponse({
    status: 400,
    description: 'Bad request - Empty payload or validation error',
  })
  @ApiResponse({ status: 409, description: 'Conflict - Email already used' })
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
  @ApiOperation({ summary: 'Update my avatar URL' })
  @ApiResponse({ status: 201, description: 'Avatar updated successfully' })
  @ApiResponse({ status: 400, description: 'Bad request - Invalid URL' })
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
  @ApiOperation({ summary: 'Get my booking history' })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: 'Number of results (default: 20, max: 100)',
  })
  @ApiResponse({ status: 200, description: 'History retrieved successfully' })
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
  @ApiOperation({ summary: 'Anonymize and delete my account' })
  @ApiResponse({ status: 200, description: 'Account anonymized successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async deleteMe(@CurrentUser() user: AuthUser) {
    await this.usersService.anonymizeMe(user.sub);
    return createApiResponse(
      null,
      appMessage('USERS_ACCOUNT_ANONYMIZED').message,
    );
  }
}
