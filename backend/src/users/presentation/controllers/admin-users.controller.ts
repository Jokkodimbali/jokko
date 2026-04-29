import {
  Controller,
  Get,
  Param,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
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
import { UsersService } from '../../application/services/users.service';
import { ListAdminUsersQueryDto } from '../dto/list-admin-users-query.dto';

@ApiTags(API_DOCS.adminUsers.tag)
@ApiBearerAuth()
@Controller('admin/users')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AdminUsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @Roles(RoleUtilisateur.ADMIN)
  @ApiOperation({ summary: API_DOCS.adminUsers.listSummary })
  @ApiQuery({
    name: 'role',
    required: false,
    enum: RoleUtilisateur,
    description: API_DOCS.adminUsers.roleFilter,
    example: API_DOCS.adminUsers.roleExample,
  })
  @ApiQuery({
    name: 'isActive',
    required: false,
    type: Boolean,
    description: API_DOCS.adminUsers.isActiveFilter,
    example: API_DOCS.adminUsers.isActiveExample,
  })
  @ApiQuery({
    name: 'search',
    required: false,
    type: String,
    description: API_DOCS.adminUsers.searchFilter,
    example: API_DOCS.adminUsers.searchExample,
  })
  @ApiStandardSuccessResponse({
    status: 200,
    description: API_DOCS.adminUsers.listSuccess,
    messageExample: appMessage('USERS_LISTED').message,
    dataSchema: {
      type: 'array',
      items: { type: 'object' },
      example: SWAGGER_RESPONSE_EXAMPLES.users.adminListData,
    },
  })
  @ApiStandardErrorResponse({
    status: 403,
    description: API_DOCS.adminUsers.adminOnly,
    errorCode: 'USERS_ADMIN_FORBIDDEN_ROLE',
    messageExample: API_DOCS.adminUsers.adminOnly,
  })
  async listUsers(
    @CurrentUser() user: AuthUser,
    @Query() query: ListAdminUsersQueryDto,
  ) {
    const result = await this.usersService.listForAdmin(user, query);
    return createApiResponse(result, appMessage('USERS_LISTED').message);
  }

  @Get(':userId/history')
  @Roles(RoleUtilisateur.ADMIN)
  @ApiOperation({ summary: API_DOCS.adminUsers.getHistorySummary })
  @ApiParam({
    name: 'userId',
    description: API_DOCS.adminUsers.userIdParam,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    type: Number,
    description: API_DOCS.adminUsers.limitField,
    example: API_DOCS.adminUsers.limitExample,
  })
  @ApiStandardSuccessResponse({
    status: 200,
    description: API_DOCS.adminUsers.historySuccess,
    messageExample: appMessage('USERS_HISTORY_RETRIEVED').message,
    dataSchema: {
      type: 'object',
      example: SWAGGER_RESPONSE_EXAMPLES.users.adminHistoryData,
    },
  })
  @ApiStandardErrorResponse({
    status: 403,
    description: API_DOCS.adminUsers.adminOnly,
    errorCode: 'USERS_ADMIN_FORBIDDEN_ROLE',
    messageExample: API_DOCS.adminUsers.adminOnly,
  })
  @ApiStandardErrorResponse({
    status: 404,
    description: appMessage('USERS_USER_NOT_FOUND').message,
    errorCode: 'USERS_USER_NOT_FOUND',
    messageExample: appMessage('USERS_USER_NOT_FOUND').message,
  })
  async getUserHistory(
    @CurrentUser() user: AuthUser,
    @Param('userId') userId: string,
    @Query() query: ListAdminUsersQueryDto,
  ) {
    const result = await this.usersService.getHistoryForAdmin(
      user,
      userId,
      query.limit ?? 20,
    );
    return createApiResponse(
      result,
      appMessage('USERS_HISTORY_RETRIEVED').message,
    );
  }

  @Get(':userId')
  @Roles(RoleUtilisateur.ADMIN)
  @ApiOperation({ summary: API_DOCS.adminUsers.getByIdSummary })
  @ApiParam({
    name: 'userId',
    description: API_DOCS.adminUsers.userIdParam,
  })
  @ApiStandardSuccessResponse({
    status: 200,
    description: API_DOCS.adminUsers.getByIdSuccess,
    messageExample: API_DOCS.adminUsers.getByIdSuccess,
    dataSchema: {
      type: 'object',
      example: SWAGGER_RESPONSE_EXAMPLES.users.profileData,
    },
  })
  @ApiStandardErrorResponse({
    status: 403,
    description: API_DOCS.adminUsers.adminOnly,
    errorCode: 'USERS_ADMIN_FORBIDDEN_ROLE',
    messageExample: API_DOCS.adminUsers.adminOnly,
  })
  @ApiStandardErrorResponse({
    status: 404,
    description: appMessage('USERS_USER_NOT_FOUND').message,
    errorCode: 'USERS_USER_NOT_FOUND',
    messageExample: appMessage('USERS_USER_NOT_FOUND').message,
  })
  async getUser(
    @CurrentUser() user: AuthUser,
    @Param('userId') userId: string,
  ) {
    const result = await this.usersService.getForAdmin(user, userId);
    return createApiResponse(result);
  }

  @Patch(':userId/block')
  @Roles(RoleUtilisateur.ADMIN)
  @ApiOperation({ summary: API_DOCS.adminUsers.blockSummary })
  @ApiParam({
    name: 'userId',
    description: API_DOCS.adminUsers.userIdParam,
  })
  @ApiStandardSuccessResponse({
    status: 200,
    description: API_DOCS.adminUsers.blockSuccess,
    messageExample: API_DOCS.adminUsers.blockSuccess,
    dataSchema: {
      type: 'object',
      example: {
        ...SWAGGER_RESPONSE_EXAMPLES.users.profileData,
        estActif: false,
      },
    },
  })
  @ApiStandardErrorResponse({
    status: 403,
    description: API_DOCS.adminUsers.adminOnly,
    errorCode: 'USERS_ADMIN_FORBIDDEN_ROLE',
    messageExample: API_DOCS.adminUsers.adminOnly,
  })
  @ApiStandardErrorResponse({
    status: 404,
    description: appMessage('USERS_USER_NOT_FOUND').message,
    errorCode: 'USERS_USER_NOT_FOUND',
    messageExample: appMessage('USERS_USER_NOT_FOUND').message,
  })
  async blockUser(
    @CurrentUser() user: AuthUser,
    @Param('userId') userId: string,
  ) {
    const result = await this.usersService.blockUser(user, userId);
    return createApiResponse(result, appMessage('USERS_BLOCKED').message);
  }

  @Patch(':userId/unblock')
  @Roles(RoleUtilisateur.ADMIN)
  @ApiOperation({ summary: API_DOCS.adminUsers.unblockSummary })
  @ApiParam({
    name: 'userId',
    description: API_DOCS.adminUsers.userIdParam,
  })
  @ApiStandardSuccessResponse({
    status: 200,
    description: API_DOCS.adminUsers.unblockSuccess,
    messageExample: API_DOCS.adminUsers.unblockSuccess,
    dataSchema: {
      type: 'object',
      example: {
        ...SWAGGER_RESPONSE_EXAMPLES.users.profileData,
        estActif: true,
      },
    },
  })
  @ApiStandardErrorResponse({
    status: 403,
    description: API_DOCS.adminUsers.adminOnly,
    errorCode: 'USERS_ADMIN_FORBIDDEN_ROLE',
    messageExample: API_DOCS.adminUsers.adminOnly,
  })
  @ApiStandardErrorResponse({
    status: 404,
    description: appMessage('USERS_USER_NOT_FOUND').message,
    errorCode: 'USERS_USER_NOT_FOUND',
    messageExample: appMessage('USERS_USER_NOT_FOUND').message,
  })
  async unblockUser(
    @CurrentUser() user: AuthUser,
    @Param('userId') userId: string,
  ) {
    const result = await this.usersService.unblockUser(user, userId);
    return createApiResponse(result, appMessage('USERS_UNBLOCKED').message);
  }
}
