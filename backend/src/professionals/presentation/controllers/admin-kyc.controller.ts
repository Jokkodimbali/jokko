import { Body, Controller, Param, Patch, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../../auth/security/jwt-auth.guard';
import { CurrentUser } from '../../../auth/security/current-user.decorator';
import type { AuthUser } from '../../../auth/security/auth-user.type';
import { appMessage } from '../../../core/http/app-http.exception';
import { ProfessionalsFacade } from '../../application/services/professionals-facade.service';
import { RejectKycDto } from '../dto/reject-kyc.dto';
import { createApiResponse } from '../../../shared/dto/api-response.dto';

@Controller('admin/kyc')
export class AdminKycController {
  constructor(private readonly professionalsFacade: ProfessionalsFacade) {}

  @Patch(':professionalId/approve')
  @UseGuards(JwtAuthGuard)
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
  @UseGuards(JwtAuthGuard)
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
