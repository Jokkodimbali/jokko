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
      clientPayments: {
        ...allClientPayments,
        payments: allClientPayments.payments.map((payment) => payment.toView()),
      },
      professionalPayments: {
        ...allProfessionalPayments,
        payments: allProfessionalPayments.payments.map((payment) =>
          payment.toView(),
        ),
      },
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
}
