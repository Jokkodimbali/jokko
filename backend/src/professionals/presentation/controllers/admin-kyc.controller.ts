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
import { API_DOCS } from '../../../core/messages/api-docs.messages';

@ApiTags(API_DOCS.adminKyc.tag)
@Controller('admin/kyc')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class AdminKycController {
  constructor(private readonly professionalsFacade: ProfessionalsFacade) {}

  @Patch(':professionalId/approve')
  @Roles(RoleUtilisateur.ADMIN)
  @ApiOperation({ summary: API_DOCS.adminKyc.approveSummary })
  @ApiParam({
    name: 'professionalId',
    description: API_DOCS.adminKyc.professionalIdParam,
  })
  @ApiResponse({
    status: 200,
    description: appMessage('PROFESSIONALS_KYC_APPROVED').message,
  })
  @ApiResponse({ status: 403, description: API_DOCS.adminKyc.adminOnly })
  @ApiResponse({ status: 404, description: API_DOCS.common.profileNotFound })
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
  @ApiOperation({ summary: API_DOCS.adminKyc.rejectSummary })
  @ApiParam({
    name: 'professionalId',
    description: API_DOCS.adminKyc.professionalIdParam,
  })
  @ApiResponse({
    status: 200,
    description: appMessage('PROFESSIONALS_KYC_REJECTED').message,
  })
  @ApiResponse({ status: 403, description: API_DOCS.adminKyc.adminOnly })
  @ApiResponse({ status: 404, description: API_DOCS.common.profileNotFound })
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
