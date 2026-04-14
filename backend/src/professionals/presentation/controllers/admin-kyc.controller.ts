import { Body, Controller, Param, Patch, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../auth/security/jwt-auth.guard';
import { RolesGuard, Roles } from '../../../shared/guards/roles.guard';
import { CurrentUser } from '../../../auth/security/current-user.decorator';
import type { AuthUser } from '../../../auth/security/auth-user.type';
import { appMessage } from '../../../core/http/app-http.exception';
import { ProfessionalsFacade } from '../../application/services/professionals-facade.service';
import { RejectKycDto } from '../dto/reject-kyc.dto';
import { createApiResponse } from '../../../shared/dto/api-response.dto';
import { RoleUtilisateur } from '@prisma/client';

@ApiTags('Admin - KYC')
@Controller('admin/kyc')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class AdminKycController {
  constructor(private readonly professionalsFacade: ProfessionalsFacade) {}

  @Patch(':professionalId/approve')
  @Roles(RoleUtilisateur.ADMIN)
  @ApiOperation({ summary: 'Approve a professional KYC submission' })
  @ApiParam({ name: 'professionalId', description: 'Professional profile ID' })
  @ApiResponse({ status: 200, description: 'KYC approved successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden - Admin only' })
  @ApiResponse({ status: 404, description: 'Profile not found' })
  async approveKyc(
    @CurrentUser() user: AuthUser,
    @Param('professionalId') professionalId: string,
  ) {
    const result = await this.professionalsFacade.approveKyc(
      user,
      professionalId,
    );
    return createApiResponse(
      result,
      appMessage('PROFESSIONALS_KYC_APPROVED').message,
    );
  }

  @Patch(':professionalId/reject')
  @Roles(RoleUtilisateur.ADMIN)
  @ApiOperation({ summary: 'Reject a professional KYC submission' })
  @ApiParam({ name: 'professionalId', description: 'Professional profile ID' })
  @ApiResponse({ status: 200, description: 'KYC rejected successfully' })
  @ApiResponse({ status: 403, description: 'Forbidden - Admin only' })
  @ApiResponse({ status: 404, description: 'Profile not found' })
  async rejectKyc(
    @CurrentUser() user: AuthUser,
    @Param('professionalId') professionalId: string,
    @Body() dto: RejectKycDto,
  ) {
    const result = await this.professionalsFacade.rejectKyc(
      user,
      professionalId,
      dto,
    );
    return createApiResponse(
      result,
      appMessage('PROFESSIONALS_KYC_REJECTED').message,
    );
  }
}
