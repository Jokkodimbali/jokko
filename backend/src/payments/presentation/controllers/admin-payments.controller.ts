import {
  Body,
  Controller,
  Get,
  Param,
  Post,
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
import { PaymentsFacade } from '../../application/services/payments-facade.service';
import { ListPaymentsQueryDto } from '../dto/list-payments-query.dto';
import { PaymentReasonDto } from '../dto/payment-reason.dto';

@ApiTags(API_DOCS.adminPayments.tag)
@ApiBearerAuth()
@Controller('admin/payments')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AdminPaymentsController {
  constructor(private readonly paymentsFacade: PaymentsFacade) {}

  @Get()
  @Roles(RoleUtilisateur.ADMIN)
  @ApiOperation({ summary: API_DOCS.adminPayments.listSummary })
  @ApiQuery({
    name: 'status',
    required: false,
    description: API_DOCS.payments.statusFilter,
  })
  @ApiQuery({
    name: 'method',
    required: false,
    description: API_DOCS.payments.methodFilter,
  })
  @ApiQuery({
    name: 'bookingId',
    required: false,
    description: API_DOCS.payments.bookingFilter,
  })
  @ApiQuery({
    name: 'clientId',
    required: false,
    description: API_DOCS.payments.clientFilter,
  })
  @ApiQuery({
    name: 'professionalId',
    required: false,
    description: API_DOCS.payments.professionalFilter,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: API_DOCS.payments.limitDescription,
  })
  @ApiQuery({
    name: 'offset',
    required: false,
    description: API_DOCS.payments.offsetDescription,
  })
  @ApiStandardSuccessResponse({
    status: 200,
    description: API_DOCS.adminPayments.listSummary,
    messageExample: API_DOCS.adminPayments.listSummary,
    dataSchema: {
      type: 'object',
      example: SWAGGER_RESPONSE_EXAMPLES.payments.adminListData,
    },
  })
  @ApiStandardErrorResponse({
    status: 401,
    description: API_DOCS.common.unauthorized,
    errorCode: 'AUTH_TOKEN_INVALID',
    messageExample: API_DOCS.common.unauthorized,
  })
  @ApiStandardErrorResponse({
    status: 403,
    description: API_DOCS.adminPayments.adminOnly,
    errorCode: 'AUTH_FORBIDDEN',
    messageExample: API_DOCS.adminPayments.adminOnly,
  })
  async listAllPayments(@Query() query: ListPaymentsQueryDto) {
    const allClientPayments = await this.paymentsFacade.getClientPaymentHistory(
      undefined,
      query,
    );
    const allProfessionalPayments =
      await this.paymentsFacade.getProfessionalPaymentHistory(undefined, query);

    return createApiResponse({
      clientPayments: allClientPayments,
      professionalPayments: allProfessionalPayments,
    });
  }

  @Get('statistics')
  @Roles(RoleUtilisateur.ADMIN)
  @ApiOperation({ summary: API_DOCS.adminPayments.statisticsSummary })
  @ApiStandardSuccessResponse({
    status: 200,
    description: API_DOCS.adminPayments.statisticsSummary,
    messageExample: API_DOCS.adminPayments.statisticsSummary,
    dataSchema: {
      type: 'object',
      example: SWAGGER_RESPONSE_EXAMPLES.payments.adminStatisticsData,
    },
  })
  @ApiStandardErrorResponse({
    status: 401,
    description: API_DOCS.common.unauthorized,
    errorCode: 'AUTH_TOKEN_INVALID',
    messageExample: API_DOCS.common.unauthorized,
  })
  async getPaymentStatistics() {
    const stats = await this.paymentsFacade.getAdminStatistics();
    return createApiResponse(stats);
  }

  @Get(':paymentId')
  @Roles(RoleUtilisateur.ADMIN)
  @ApiOperation({ summary: API_DOCS.adminPayments.getByIdSummary })
  @ApiParam({
    name: 'paymentId',
    description: API_DOCS.payments.paymentIdParam,
  })
  @ApiStandardSuccessResponse({
    status: 200,
    description: API_DOCS.adminPayments.getByIdSummary,
    messageExample: API_DOCS.adminPayments.getByIdSummary,
    dataSchema: {
      type: 'object',
      example: SWAGGER_RESPONSE_EXAMPLES.payments.paymentDetailsData,
    },
  })
  @ApiStandardErrorResponse({
    status: 404,
    description: API_DOCS.common.paymentNotFound,
    errorCode: 'PAYMENTS_NOT_FOUND',
    messageExample: API_DOCS.common.paymentNotFound,
  })
  async getPaymentDetails(@Param('paymentId') paymentId: string) {
    const payment = await this.paymentsFacade.getPaymentById(paymentId);
    return createApiResponse(payment.toView());
  }

  @Post(':paymentId/refund')
  @Roles(RoleUtilisateur.ADMIN)
  @ApiOperation({ summary: API_DOCS.adminPayments.refundSummary })
  @ApiParam({
    name: 'paymentId',
    description: API_DOCS.payments.paymentIdParam,
  })
  @ApiStandardSuccessResponse({
    status: 200,
    description: API_DOCS.adminPayments.refundSummary,
    messageExample: appMessage('PAYMENTS_ESCROW_REFUNDED').message,
    dataSchema: {
      type: 'object',
      example: SWAGGER_RESPONSE_EXAMPLES.payments.refundData,
    },
  })
  @ApiStandardErrorResponse({
    status: 404,
    description: API_DOCS.common.paymentNotFound,
    errorCode: 'PAYMENTS_NOT_FOUND',
    messageExample: API_DOCS.common.paymentNotFound,
  })
  async refundPayment(
    @Param('paymentId') paymentId: string,
    @Body() body: PaymentReasonDto,
  ) {
    const payment = await this.paymentsFacade.refundPayment(
      paymentId,
      body.reason,
    );

    return createApiResponse(
      {
        payment: payment.toView(),
        isRefunded: true,
      },
      appMessage('PAYMENTS_ESCROW_REFUNDED').message,
    );
  }

  @Get('escrow/pending')
  @Roles(RoleUtilisateur.ADMIN)
  @ApiOperation({ summary: API_DOCS.adminPayments.escrowPendingSummary })
  @ApiStandardSuccessResponse({
    status: 200,
    description: API_DOCS.adminPayments.escrowPendingSummary,
    messageExample: API_DOCS.adminPayments.escrowPendingSummary,
    dataSchema: {
      type: 'array',
      items: { type: 'object' },
      example: SWAGGER_RESPONSE_EXAMPLES.payments.pendingEscrowData,
    },
  })
  async getPendingEscrowReleases() {
    const payments = await this.paymentsFacade.getPendingEscrowReleases();

    const result = payments.map((payment) => ({
      id: payment.id,
      bookingId: payment.bookingId,
      clientId: payment.clientId,
      professionalId: payment.professionalId,
      amount: payment.amount.getValue(),
      netAmount: payment.netAmount.getValue(),
      commissionAmount: payment.commissionAmount.getValue(),
      createdAt: payment.createdAt,
    }));

    return createApiResponse(result);
  }

  @Post('escrow/process-pending')
  @Roles(RoleUtilisateur.ADMIN)
  @ApiOperation({
    summary: API_DOCS.adminPayments.escrowProcessPendingSummary,
  })
  @ApiStandardSuccessResponse({
    status: 200,
    description: API_DOCS.adminPayments.escrowProcessPendingSummary,
    messageExample: appMessage('PAYMENTS_ESCROW_RELEASED').message,
    dataSchema: {
      type: 'object',
      example: SWAGGER_RESPONSE_EXAMPLES.payments.processPendingEscrowData,
    },
  })
  async processPendingEscrowReleases() {
    const payments = await this.paymentsFacade.getPendingEscrowReleases();

    const processedPayments: Array<{ id: string; status: string }> = [];
    const failedPayments: Array<{ id: string; status: string; error: string }> =
      [];

    for (const payment of payments) {
      try {
        const releasedPayment =
          await this.paymentsFacade.processAutomaticEscrowRelease(payment.id);
        processedPayments.push({
          id: releasedPayment.id,
          status: 'released',
        });
      } catch (error) {
        const errorMessage =
          error instanceof Error
            ? error.message
            : appMessage('SYSTEM_INTERNAL_SERVER_ERROR').message;
        failedPayments.push({
          id: payment.id,
          status: 'error',
          error: errorMessage,
        });
      }
    }

    return createApiResponse(
      {
        processedCount: processedPayments.length,
        processedPayments,
        failedCount: failedPayments.length,
        failedPayments,
      },
      appMessage('PAYMENTS_ESCROW_RELEASED').message,
    );
  }
}
