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
import { AdminArchivesService } from '../../application/services/admin-archives.service';
import { AdminArchivesQueryDto } from '../dto/admin-archives-query.dto';

@ApiTags(API_DOCS.adminArchives.tag)
@ApiBearerAuth()
@Controller('admin/archives')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AdminArchivesController {
  constructor(private readonly adminArchivesService: AdminArchivesService) {}

  @Get()
  @Roles(RoleUtilisateur.ADMIN)
  @ApiOperation({ summary: API_DOCS.adminArchives.summary })
  async getArchives(
    @CurrentUser() user: AuthUser,
    @Query() query: AdminArchivesQueryDto,
  ) {
    const result = await this.adminArchivesService.getArchives(user, query);
    return createApiResponse(
      result,
      appMessage('ADMIN_ARCHIVES_RETRIEVED').message,
    );
  }
}
