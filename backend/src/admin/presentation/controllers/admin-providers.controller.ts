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
  ApiTags,
} from '@nestjs/swagger';
import { RoleUtilisateur } from '@prisma/client';
import { CurrentUser } from '../../../auth/security/current-user.decorator';
import type { AuthUser } from '../../../auth/security/auth-user.type';
import { JwtAuthGuard } from '../../../auth/security/jwt-auth.guard';
import { appMessage } from '../../../core/http/app-http.exception';
import {
  createApiResponse,
  createPaginatedResponse,
} from '../../../shared/dto/api-response.dto';
import { Roles, RolesGuard } from '../../../shared/guards/roles.guard';
import { AdminProvidersService } from '../../application/services/admin-providers.service';
import { ListAdminProvidersQueryDto } from '../dto/list-admin-providers-query.dto';

@ApiTags('Admin - Prestataires')
@ApiBearerAuth()
@Controller('admin/providers')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AdminProvidersController {
  constructor(private readonly adminProvidersService: AdminProvidersService) {}

  @Get()
  @Roles(RoleUtilisateur.ADMIN)
  @ApiOperation({ summary: 'Lister les prestataires pour la console admin' })
  async listProviders(
    @CurrentUser() user: AuthUser,
    @Query() query: ListAdminProvidersQueryDto,
  ) {
    const result = await this.adminProvidersService.listProviders(user, query);
    const response = createPaginatedResponse(
      result.items,
      result.total,
      result.page,
      result.limit,
    );
    response.message = appMessage('ADMIN_PROVIDERS_RETRIEVED').message;
    response.meta = {
      ...response.meta,
      stats: result.stats,
    };
    return response;
  }

  @Get(':providerId')
  @Roles(RoleUtilisateur.ADMIN)
  @ApiOperation({ summary: 'Consulter le detail complet d un prestataire' })
  @ApiParam({
    name: 'providerId',
    description: 'Identifiant du profil prestataire',
  })
  async getProvider(
    @CurrentUser() user: AuthUser,
    @Param('providerId') providerId: string,
  ) {
    const result = await this.adminProvidersService.getProvider(
      user,
      providerId,
    );
    return createApiResponse(
      result,
      appMessage('ADMIN_PROVIDERS_RETRIEVED').message,
    );
  }

  @Patch(':providerId/activate')
  @Roles(RoleUtilisateur.ADMIN)
  @ApiOperation({ summary: 'Activer le compte d un prestataire' })
  @ApiParam({
    name: 'providerId',
    description: 'Identifiant du profil prestataire',
  })
  async activateProvider(
    @CurrentUser() user: AuthUser,
    @Param('providerId') providerId: string,
  ) {
    const result = await this.adminProvidersService.setProviderActivation(
      user,
      providerId,
      true,
    );
    return createApiResponse(
      result,
      appMessage('ADMIN_PROVIDERS_RETRIEVED').message,
    );
  }

  @Patch(':providerId/deactivate')
  @Roles(RoleUtilisateur.ADMIN)
  @ApiOperation({ summary: 'Desactiver le compte d un prestataire' })
  @ApiParam({
    name: 'providerId',
    description: 'Identifiant du profil prestataire',
  })
  async deactivateProvider(
    @CurrentUser() user: AuthUser,
    @Param('providerId') providerId: string,
  ) {
    const result = await this.adminProvidersService.setProviderActivation(
      user,
      providerId,
      false,
    );
    return createApiResponse(
      result,
      appMessage('ADMIN_PROVIDERS_RETRIEVED').message,
    );
  }
}
