import {
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
  Body,
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
import { DisputesFacade } from '../../application/services/disputes-facade.service';
import { DisputeMediationMessageService } from '../../application/services/dispute-mediation-message.service';
import { ListDisputesQueryDto } from '../dto/list-disputes-query.dto';
import {
  RejectDisputeDto,
  ResolveDisputeDto,
} from '../dto/resolve-dispute.dto';
import { SendDisputeMessageDto } from '../dto/send-dispute-message.dto';

@ApiTags(API_DOCS.disputes.tag)
@ApiBearerAuth()
@Controller('admin/disputes')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AdminDisputesController {
  constructor(
    private readonly disputesFacade: DisputesFacade,
    private readonly disputeMessages: DisputeMediationMessageService,
  ) {}

  @Get()
  @Roles(RoleUtilisateur.ADMIN)
  @ApiOperation({ summary: API_DOCS.disputes.listSummary })
  @ApiQuery({
    name: 'status',
    required: false,
    description: API_DOCS.disputes.statusFilter,
  })
  @ApiQuery({
    name: 'priority',
    required: false,
    description: API_DOCS.disputes.priorityFilter,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: API_DOCS.disputes.limitField,
  })
  @ApiQuery({
    name: 'cursor',
    required: false,
    description: API_DOCS.disputes.cursorField,
  })
  @ApiStandardSuccessResponse({
    status: 200,
    description: API_DOCS.disputes.listSuccess,
    messageExample: appMessage('DISPUTES_LISTED').message,
    dataSchema: {
      type: 'array',
      items: { type: 'object' },
      example: SWAGGER_RESPONSE_EXAMPLES.disputes.listData,
    },
  })
  async listDisputes(@Query() query: ListDisputesQueryDto) {
    const result = await this.disputesFacade.listForAdmin(query);
    return {
      success: true,
      data: result.items,
      message: appMessage('DISPUTES_LISTED').message,
      meta: {
        nextCursor: result.nextCursor,
      },
    };
  }

  @Get(':disputeId')
  @Roles(RoleUtilisateur.ADMIN)
  @ApiOperation({ summary: API_DOCS.disputes.getByIdSummary })
  @ApiParam({
    name: 'disputeId',
    description: API_DOCS.disputes.disputeIdParam,
  })
  @ApiStandardSuccessResponse({
    status: 200,
    description: API_DOCS.disputes.getByIdSuccess,
    messageExample: appMessage('DISPUTES_RETRIEVED').message,
    dataSchema: {
      type: 'object',
      example: SWAGGER_RESPONSE_EXAMPLES.disputes.detailData,
    },
  })
  @ApiStandardErrorResponse({
    status: 404,
    description: appMessage('DISPUTES_NOT_FOUND').message,
    errorCode: 'DISPUTES_NOT_FOUND',
    messageExample: appMessage('DISPUTES_NOT_FOUND').message,
  })
  async getDispute(@Param('disputeId') disputeId: string) {
    const result = await this.disputesFacade.getById(disputeId);
    return createApiResponse(result, appMessage('DISPUTES_RETRIEVED').message);
  }

  @Patch(':disputeId/in-review')
  @Roles(RoleUtilisateur.ADMIN)
  @ApiOperation({ summary: API_DOCS.disputes.markInReviewSummary })
  @ApiParam({
    name: 'disputeId',
    description: API_DOCS.disputes.disputeIdParam,
  })
  @ApiStandardSuccessResponse({
    status: 200,
    description: API_DOCS.disputes.markInReviewSuccess,
    messageExample: appMessage('DISPUTES_MARKED_IN_REVIEW').message,
    dataSchema: {
      type: 'object',
      example: {
        ...SWAGGER_RESPONSE_EXAMPLES.disputes.detailData,
        statut: 'EN_REVUE',
      },
    },
  })
  @ApiStandardErrorResponse({
    status: 404,
    description: appMessage('DISPUTES_NOT_FOUND').message,
    errorCode: 'DISPUTES_NOT_FOUND',
    messageExample: appMessage('DISPUTES_NOT_FOUND').message,
  })
  @ApiStandardErrorResponse({
    status: 409,
    description: API_DOCS.disputes.invalidStatusConflict,
    errorCode: 'DISPUTES_INVALID_STATUS',
    messageExample: appMessage('DISPUTES_INVALID_STATUS').message,
  })
  async markInReview(
    @CurrentUser() user: AuthUser,
    @Param('disputeId') disputeId: string,
  ) {
    const result = await this.disputesFacade.markInReview(user, disputeId);
    return createApiResponse(
      result,
      appMessage('DISPUTES_MARKED_IN_REVIEW').message,
    );
  }

  @Patch(':disputeId/resolve')
  @Roles(RoleUtilisateur.ADMIN)
  @ApiOperation({ summary: API_DOCS.disputes.resolveSummary })
  @ApiParam({
    name: 'disputeId',
    description: API_DOCS.disputes.disputeIdParam,
  })
  @ApiStandardSuccessResponse({
    status: 200,
    description: API_DOCS.disputes.resolveSuccess,
    messageExample: appMessage('DISPUTES_RESOLVED').message,
    dataSchema: {
      type: 'object',
      example: SWAGGER_RESPONSE_EXAMPLES.disputes.resolutionData,
    },
  })
  @ApiStandardErrorResponse({
    status: 404,
    description: appMessage('DISPUTES_NOT_FOUND').message,
    errorCode: 'DISPUTES_NOT_FOUND',
    messageExample: appMessage('DISPUTES_NOT_FOUND').message,
  })
  @ApiStandardErrorResponse({
    status: 400,
    description: API_DOCS.disputes.invalidResolution,
    errorCode: 'DISPUTES_INVALID_RESOLUTION',
    messageExample: appMessage('DISPUTES_INVALID_RESOLUTION').message,
  })
  @ApiStandardErrorResponse({
    status: 409,
    description: API_DOCS.disputes.invalidStatusConflict,
    errorCode: 'DISPUTES_INVALID_STATUS',
    messageExample: appMessage('DISPUTES_INVALID_STATUS').message,
  })
  async resolveDispute(
    @CurrentUser() user: AuthUser,
    @Param('disputeId') disputeId: string,
    @Body() body: ResolveDisputeDto,
  ) {
    const result = await this.disputesFacade.resolve(user, disputeId, body);
    return createApiResponse(
      {
        dispute: result.dispute,
        clientRefundAmount: result.clientRefundAmount,
        professionalPayoutAmount: result.professionalPayoutAmount,
      },
      appMessage('DISPUTES_RESOLVED').message,
    );
  }

  @Patch(':disputeId/reject')
  @Roles(RoleUtilisateur.ADMIN)
  @ApiOperation({ summary: API_DOCS.disputes.rejectSummary })
  @ApiParam({
    name: 'disputeId',
    description: API_DOCS.disputes.disputeIdParam,
  })
  @ApiStandardSuccessResponse({
    status: 200,
    description: API_DOCS.disputes.rejectSuccess,
    messageExample: appMessage('DISPUTES_REJECTED').message,
    dataSchema: {
      type: 'object',
      example: {
        ...SWAGGER_RESPONSE_EXAMPLES.disputes.detailData,
        statut: 'REJETE',
      },
    },
  })
  @ApiStandardErrorResponse({
    status: 404,
    description: appMessage('DISPUTES_NOT_FOUND').message,
    errorCode: 'DISPUTES_NOT_FOUND',
    messageExample: appMessage('DISPUTES_NOT_FOUND').message,
  })
  @ApiStandardErrorResponse({
    status: 409,
    description: API_DOCS.disputes.invalidStatusConflict,
    errorCode: 'DISPUTES_INVALID_STATUS',
    messageExample: appMessage('DISPUTES_INVALID_STATUS').message,
  })
  async rejectDispute(
    @CurrentUser() user: AuthUser,
    @Param('disputeId') disputeId: string,
    @Body() body: RejectDisputeDto,
  ) {
    const result = await this.disputesFacade.reject(user, disputeId, body);
    return createApiResponse(result, appMessage('DISPUTES_REJECTED').message);
  }

  @Post(':disputeId/messages')
  @Roles(RoleUtilisateur.ADMIN)
  async sendMediationMessage(
    @CurrentUser() user: AuthUser,
    @Param('disputeId') disputeId: string,
    @Body() body: SendDisputeMessageDto,
  ) {
    const result = await this.disputeMessages.send(user, disputeId, body);
    return createApiResponse(
      result,
      appMessage('DISPUTES_MESSAGE_SENT').message,
    );
  }
}
