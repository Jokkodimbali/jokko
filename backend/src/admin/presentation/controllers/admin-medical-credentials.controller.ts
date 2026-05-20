import { Body, Controller, Get, Param, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RoleUtilisateur } from '@prisma/client';
import { CurrentUser } from '../../../auth/security/current-user.decorator';
import type { AuthUser } from '../../../auth/security/auth-user.type';
import { JwtAuthGuard } from '../../../auth/security/jwt-auth.guard';
import { appMessage } from '../../../core/http/app-http.exception';
import { createApiResponse } from '../../../shared/dto/api-response.dto';
import { Roles, RolesGuard } from '../../../shared/guards/roles.guard';
import { AdminMedicalCredentialsService } from '../../application/services/admin-medical-credentials.service';

@ApiTags('Admin - Diplomes medecins')
@ApiBearerAuth()
@Controller('admin/medical-credentials')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AdminMedicalCredentialsController {
  constructor(
    private readonly medicalCredentials: AdminMedicalCredentialsService,
  ) {}

  @Get()
  @Roles(RoleUtilisateur.ADMIN)
  @ApiOperation({ summary: 'Lister les diplomes medecins a verifier' })
  async listPending(@CurrentUser() user: AuthUser) {
    const result = await this.medicalCredentials.listPending(user);
    return createApiResponse(
      result,
      appMessage('ADMIN_MEDICAL_CREDENTIALS_RETRIEVED').message,
    );
  }

  @Patch(':professionalId/certify')
  @Roles(RoleUtilisateur.ADMIN)
  @ApiOperation({ summary: 'Certifier les diplomes du medecin' })
  async certify(
    @CurrentUser() user: AuthUser,
    @Param('professionalId') professionalId: string,
  ) {
    const result = await this.medicalCredentials.certify(user, professionalId);
    return createApiResponse(
      result,
      appMessage('ADMIN_MEDICAL_CREDENTIALS_CERTIFIED').message,
    );
  }

  @Patch(':professionalId/reject')
  @Roles(RoleUtilisateur.ADMIN)
  @ApiOperation({ summary: 'Rejeter les diplomes du medecin' })
  async reject(
    @CurrentUser() user: AuthUser,
    @Param('professionalId') professionalId: string,
    @Body() body: { reason?: string },
  ) {
    const result = await this.medicalCredentials.reject(
      user,
      professionalId,
      body.reason ?? '',
    );
    return createApiResponse(
      result,
      appMessage('ADMIN_MEDICAL_CREDENTIALS_REJECTED').message,
    );
  }
}
