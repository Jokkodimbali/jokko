import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
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
import { ListAdminKycQueryDto } from '../dto/list-admin-kyc-query.dto';
import {
  createApiResponse,
  createPaginatedResponse,
} from '../../../shared/dto/api-response.dto';
import { RoleUtilisateur } from '@prisma/client';
import { API_DOCS } from '../../../core/messages/api-docs.messages';
import {
  ApiStandardErrorResponse,
  ApiStandardSuccessResponse,
} from '../../../shared/swagger/api-response-swagger.dto';
import { SWAGGER_RESPONSE_EXAMPLES } from '../../../shared/swagger/swagger-response.examples';

@ApiTags(API_DOCS.adminKyc.tag)
@Controller('admin/kyc')
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class AdminKycController {
  constructor(private readonly professionalsFacade: ProfessionalsFacade) {}

  @Get()
  @Roles(RoleUtilisateur.ADMIN)
  @ApiOperation({ summary: API_DOCS.adminKyc.listSummary })
  @ApiStandardSuccessResponse({
    status: 200,
    description: API_DOCS.adminKyc.listSuccess,
    messageExample: API_DOCS.adminKyc.listSuccess,
    dataSchema: {
      type: 'array',
      items: { type: 'object' },
      example: SWAGGER_RESPONSE_EXAMPLES.professionals.adminKycListData,
    },
  })
  @ApiStandardErrorResponse({
    status: 403,
    description: API_DOCS.adminKyc.adminOnly,
    errorCode: 'PROFESSIONALS_ADMIN_FORBIDDEN_ROLE',
    messageExample: API_DOCS.adminKyc.adminOnly,
  })
  async listKyc(
    @CurrentUser() user: AuthUser,
    @Query() query: ListAdminKycQueryDto,
  ) {
    const result = await this.professionalsFacade.listKycForAdmin(user, query);
    return createPaginatedResponse(
      result.items,
      result.total,
      Math.floor(result.offset / result.limit) + 1,
      result.limit,
    );
  }

  @Get(':professionalId')
  @Roles(RoleUtilisateur.ADMIN)
  @ApiOperation({ summary: API_DOCS.adminKyc.getByIdSummary })
  @ApiParam({
    name: 'professionalId',
    description: API_DOCS.adminKyc.professionalIdParam,
  })
  @ApiStandardSuccessResponse({
    status: 200,
    description: API_DOCS.adminKyc.getByIdSuccess,
    messageExample: API_DOCS.adminKyc.getByIdSuccess,
    dataSchema: {
      type: 'object',
      example: SWAGGER_RESPONSE_EXAMPLES.professionals.adminKycListData[0],
    },
  })
  @ApiStandardErrorResponse({
    status: 403,
    description: API_DOCS.adminKyc.adminOnly,
    errorCode: 'PROFESSIONALS_ADMIN_FORBIDDEN_ROLE',
    messageExample: API_DOCS.adminKyc.adminOnly,
  })
  @ApiStandardErrorResponse({
    status: 404,
    description: API_DOCS.common.profileNotFound,
    errorCode: 'PROFESSIONALS_PROFILE_NOT_FOUND',
    messageExample: API_DOCS.common.profileNotFound,
  })
  async getKyc(
    @CurrentUser() user: AuthUser,
    @Param('professionalId') professionalId: string,
  ) {
    const result = await this.professionalsFacade.getKycByIdForAdmin(
      user,
      professionalId,
    );
    return createApiResponse(result);
  }

  @Patch(':professionalId/approve')
  @Roles(RoleUtilisateur.ADMIN)
  @ApiOperation({ summary: API_DOCS.adminKyc.approveSummary })
  @ApiParam({
    name: 'professionalId',
    description: API_DOCS.adminKyc.professionalIdParam,
  })
  @ApiStandardSuccessResponse({
    status: 200,
    description: appMessage('PROFESSIONALS_KYC_APPROVED').message,
    messageExample: appMessage('PROFESSIONALS_KYC_APPROVED').message,
    dataSchema: {
      type: 'object',
      example: {
        ...SWAGGER_RESPONSE_EXAMPLES.professionals.profileData,
        statutKyc: 'VERIFIE',
      },
    },
  })
  @ApiStandardErrorResponse({
    status: 403,
    description: API_DOCS.adminKyc.adminOnly,
    errorCode: 'PROFESSIONALS_ADMIN_FORBIDDEN_ROLE',
    messageExample: API_DOCS.adminKyc.adminOnly,
  })
  @ApiStandardErrorResponse({
    status: 404,
    description: API_DOCS.common.profileNotFound,
    errorCode: 'PROFESSIONALS_PROFILE_NOT_FOUND',
    messageExample: API_DOCS.common.profileNotFound,
  })
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
  @ApiStandardSuccessResponse({
    status: 200,
    description: appMessage('PROFESSIONALS_KYC_REJECTED').message,
    messageExample: appMessage('PROFESSIONALS_KYC_REJECTED').message,
    dataSchema: {
      type: 'object',
      example: {
        ...SWAGGER_RESPONSE_EXAMPLES.professionals.profileData,
        statutKyc: 'REJETE',
        raisonRejetKyc: 'La photo de la carte d identite est floue.',
      },
    },
  })
  @ApiStandardErrorResponse({
    status: 403,
    description: API_DOCS.adminKyc.adminOnly,
    errorCode: 'PROFESSIONALS_ADMIN_FORBIDDEN_ROLE',
    messageExample: API_DOCS.adminKyc.adminOnly,
  })
  @ApiStandardErrorResponse({
    status: 404,
    description: API_DOCS.common.profileNotFound,
    errorCode: 'PROFESSIONALS_PROFILE_NOT_FOUND',
    messageExample: API_DOCS.common.profileNotFound,
  })
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
