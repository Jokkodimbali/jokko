import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
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
import { CurrentUser } from '../../../auth/security/current-user.decorator';
import type { AuthUser } from '../../../auth/security/auth-user.type';
import { JwtAuthGuard } from '../../../auth/security/jwt-auth.guard';
import { createApiResponse } from '../../../shared/dto/api-response.dto';
import { PaymentsFacade } from '../../application/services/payments-facade.service';
import { SavedPaymentMethodsService } from '../../application/services/saved-payment-methods.service';
import { PaymentWebhookDto } from '../dto/payment-webhook.dto';
import { InitiatePaymentDto } from '../dto/initiate-payment.dto';
import {
  SavePaymentMethodDto,
  UpdateSavedPaymentMethodDto,
} from '../dto/saved-payment-method.dto';
import { RequestWithdrawalDto } from '../dto/request-withdrawal.dto';
import { ListPaymentsQueryDto } from '../dto/list-payments-query.dto';
import { PaymentReasonDto } from '../dto/payment-reason.dto';
import { API_DOCS } from '../../../core/messages/api-docs.messages';
import { appMessage } from '../../../core/http/app-http.exception';
import {
  ApiStandardErrorResponse,
  ApiStandardSuccessResponse,
} from '../../../shared/swagger/api-response-swagger.dto';
import { SWAGGER_RESPONSE_EXAMPLES } from '../../../shared/swagger/swagger-response.examples';

@ApiTags(API_DOCS.payments.tag)
@ApiBearerAuth()
@Controller('payments')
export class PaymentsController {
  constructor(
    private readonly paymentsFacade: PaymentsFacade,
    private readonly savedPaymentMethods: SavedPaymentMethodsService,
  ) {}

  @Post('initiate')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: API_DOCS.payments.initiateSummary })
  @ApiStandardSuccessResponse({
    status: 201,
    description: API_DOCS.payments.paymentInitiated,
    messageExample: appMessage('PAYMENTS_INITIATED').message,
    dataSchema: {
      type: 'object',
      example: SWAGGER_RESPONSE_EXAMPLES.payments.initiateData,
    },
  })
  @ApiStandardErrorResponse({
    status: 400,
    description: API_DOCS.common.validationBadRequest,
    errorCode: 'VALIDATION_REQUEST_INVALID',
    messageExample: API_DOCS.common.validationBadRequest,
  })
  @ApiStandardErrorResponse({
    status: 401,
    description: API_DOCS.common.unauthorized,
    errorCode: 'AUTH_TOKEN_INVALID',
    messageExample: API_DOCS.common.unauthorized,
  })
  async initiatePayment(
    @CurrentUser() user: AuthUser,
    @Body() dto: InitiatePaymentDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    const result = await this.paymentsFacade.initiatePaymentForReservation(
      user,
      {
        ...dto,
        idempotencyKey,
      },
    );

    return createApiResponse(
      {
        payment: result.payment.toView(),
        paymentUrl: result.paymentUrl,
        gatewayReference: result.gatewayReference,
      },
      appMessage('PAYMENTS_INITIATED').message,
    );
  }

  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: API_DOCS.payments.webhookSummary })
  @ApiStandardSuccessResponse({
    status: 200,
    description: API_DOCS.payments.webhookProcessed,
    messageExample: appMessage('PAYMENTS_WEBHOOK_PROCESSED').message,
    dataSchema: {
      type: 'object',
      example: {
        processed: true,
      },
    },
  })
  @ApiStandardErrorResponse({
    status: 400,
    description: API_DOCS.common.validationBadRequest,
    errorCode: 'VALIDATION_REQUEST_INVALID',
    messageExample: API_DOCS.common.validationBadRequest,
  })
  async webhook(@Body() webhookData: PaymentWebhookDto) {
    const result = await this.paymentsFacade.processGatewayWebhookEvent({
      gatewayReference: webhookData.gatewayReference,
      invoiceToken: webhookData.invoice_token,
      status: webhookData.status,
      signature: webhookData.signature,
      timestamp: webhookData.timestamp,
      payload: webhookData.toRecord(),
    });

    return createApiResponse(
      result,
      appMessage('PAYMENTS_WEBHOOK_PROCESSED').message,
    );
  }

  @Get('history')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: API_DOCS.payments.historySummary })
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
    description: API_DOCS.payments.historySummary,
    messageExample: API_DOCS.payments.historySummary,
    dataSchema: {
      type: 'object',
      example: SWAGGER_RESPONSE_EXAMPLES.payments.historyData,
    },
  })
  async getClientPaymentHistory(
    @CurrentUser() user: AuthUser,
    @Query() query: ListPaymentsQueryDto,
  ) {
    const result = await this.paymentsFacade.getClientPaymentHistory(
      user.sub,
      query,
    );
    return createApiResponse(result);
  }

  @Get('withdrawals')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: API_DOCS.payments.withdrawalsSummary })
  @ApiStandardSuccessResponse({
    status: 200,
    description: API_DOCS.payments.withdrawalsSummary,
    messageExample: API_DOCS.payments.withdrawalsSummary,
    dataSchema: {
      type: 'array',
      items: {
        type: 'object',
      },
      example: SWAGGER_RESPONSE_EXAMPLES.payments.withdrawalsData,
    },
  })
  async getWithdrawalHistory(@CurrentUser() user: AuthUser) {
    const withdrawals =
      await this.paymentsFacade.getProfessionalWithdrawalsForUser(user);
    return createApiResponse(withdrawals);
  }

  @Get('wallet')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Consulter le wallet du prestataire connecte' })
  @ApiStandardSuccessResponse({
    status: 200,
    description: 'Wallet du prestataire connecte',
    messageExample: 'Wallet du prestataire connecte',
    dataSchema: {
      type: 'object',
      example: {
        professionalId: '33333333-3333-4333-8333-333333333333',
        availableBalance: 92000,
        monthlyRevenue: {
          amount: 62000,
          changePercent: 12,
          consultationCount: 28,
          teleconsultationCount: 28,
          refundedCancellationCount: 1,
        },
        transactions: [],
      },
    },
  })
  async getProfessionalWallet(@CurrentUser() user: AuthUser) {
    const wallet = await this.paymentsFacade.getProfessionalWalletForUser(user);
    return createApiResponse(wallet);
  }

  @Post('withdraw')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: API_DOCS.payments.withdrawSummary })
  @ApiStandardSuccessResponse({
    status: 201,
    description: API_DOCS.payments.withdrawalCreated,
    messageExample: appMessage('PAYMENTS_WITHDRAWAL_REQUESTED').message,
    dataSchema: {
      type: 'object',
      example: {
        withdrawalId: 'b50e8400-e29b-41d4-a716-446655440006',
        amount: 15000,
        method: 'WAVE',
        status: 'EN_ATTENTE',
      },
    },
  })
  @ApiStandardErrorResponse({
    status: 400,
    description: API_DOCS.common.validationBadRequest,
    errorCode: 'WITHDRAWAL_AMOUNT_INVALID',
    messageExample: API_DOCS.common.validationBadRequest,
  })
  async requestWithdrawal(
    @CurrentUser() user: AuthUser,
    @Body() dto: RequestWithdrawalDto,
  ) {
    const withdrawal = await this.paymentsFacade.requestWithdrawalForUser(
      user,
      dto,
    );

    return createApiResponse(
      {
        withdrawalId: withdrawal.id,
        amount: withdrawal.amount.getValue(),
        method: withdrawal.method,
        status: withdrawal.status,
        requestedAt: withdrawal.requestedAt,
      },
      appMessage('PAYMENTS_WITHDRAWAL_REQUESTED').message,
    );
  }

  @Get('methods/saved')
  @UseGuards(JwtAuthGuard)
  async listSavedPaymentMethods(@CurrentUser() user: AuthUser) {
    const methods = await this.savedPaymentMethods.list(user.sub);
    return createApiResponse(methods);
  }

  @Post('methods/saved')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  async createSavedPaymentMethod(
    @CurrentUser() user: AuthUser,
    @Body() dto: SavePaymentMethodDto,
  ) {
    const method = await this.savedPaymentMethods.create(user.sub, dto);
    return createApiResponse(method, 'Moyen de paiement enregistre.');
  }

  @Patch('methods/saved/:methodId')
  @UseGuards(JwtAuthGuard)
  async updateSavedPaymentMethod(
    @CurrentUser() user: AuthUser,
    @Param('methodId') methodId: string,
    @Body() dto: UpdateSavedPaymentMethodDto,
  ) {
    const method = await this.savedPaymentMethods.update(
      user.sub,
      methodId,
      dto,
    );
    return createApiResponse(method, 'Moyen de paiement modifie.');
  }

  @Delete('methods/saved/:methodId')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async deleteSavedPaymentMethod(
    @CurrentUser() user: AuthUser,
    @Param('methodId') methodId: string,
  ) {
    await this.savedPaymentMethods.remove(user.sub, methodId);
    return createApiResponse(null, 'Moyen de paiement supprime.');
  }

  @Get(':paymentId')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: API_DOCS.payments.getByIdSummary })
  @ApiParam({
    name: 'paymentId',
    description: API_DOCS.payments.paymentIdParam,
  })
  @ApiStandardSuccessResponse({
    status: 200,
    description: API_DOCS.payments.getByIdSummary,
    messageExample: API_DOCS.payments.getByIdSummary,
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
  async getPaymentDetails(
    @CurrentUser() user: AuthUser,
    @Param('paymentId') paymentId: string,
  ) {
    const payment = await this.paymentsFacade.getPaymentForUser(
      user,
      paymentId,
    );
    return createApiResponse(payment.toView());
  }

  @Patch(':paymentId/escrow/release')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: API_DOCS.payments.escrowReleaseSummary,
  })
  @ApiParam({
    name: 'paymentId',
    description: API_DOCS.payments.paymentIdParam,
  })
  @ApiStandardSuccessResponse({
    status: 200,
    description: appMessage('PAYMENTS_ESCROW_RELEASED').message,
    messageExample: appMessage('PAYMENTS_ESCROW_RELEASED').message,
    dataSchema: {
      type: 'object',
      example: {
        payment: SWAGGER_RESPONSE_EXAMPLES.payments.paymentDetailsData,
        escrowReleased: true,
      },
    },
  })
  async releaseEscrow(
    @CurrentUser() user: AuthUser,
    @Param('paymentId') paymentId: string,
  ) {
    const payment = await this.paymentsFacade.releaseEscrowForUser(
      user,
      paymentId,
    );

    return createApiResponse(
      {
        payment: payment.toView(),
        escrowReleased: true,
      },
      appMessage('PAYMENTS_ESCROW_RELEASED').message,
    );
  }

  @Patch(':paymentId/escrow/dispute')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: API_DOCS.payments.escrowDisputeSummary })
  @ApiParam({
    name: 'paymentId',
    description: API_DOCS.payments.paymentIdParam,
  })
  @ApiStandardSuccessResponse({
    status: 200,
    description: appMessage('PAYMENTS_ESCROW_DISPUTED').message,
    messageExample: appMessage('PAYMENTS_ESCROW_DISPUTED').message,
    dataSchema: {
      type: 'object',
      example: {
        payment: SWAGGER_RESPONSE_EXAMPLES.payments.paymentDetailsData,
        isDisputed: true,
      },
    },
  })
  async disputeEscrow(
    @CurrentUser() user: AuthUser,
    @Param('paymentId') paymentId: string,
    @Body() body: PaymentReasonDto,
  ) {
    const payment = await this.paymentsFacade.disputeEscrowForUser(
      user,
      paymentId,
      body.reason,
    );

    return createApiResponse(
      {
        payment: payment.toView(),
        isDisputed: true,
      },
      appMessage('PAYMENTS_ESCROW_DISPUTED').message,
    );
  }

  @Get(':paymentId/escrow/status')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: API_DOCS.payments.escrowStatusSummary })
  @ApiParam({
    name: 'paymentId',
    description: API_DOCS.payments.paymentIdParam,
  })
  @ApiStandardSuccessResponse({
    status: 200,
    description: API_DOCS.payments.escrowStatusSummary,
    messageExample: API_DOCS.payments.escrowStatusSummary,
    dataSchema: {
      type: 'object',
      example: SWAGGER_RESPONSE_EXAMPLES.payments.escrowStatusData,
    },
  })
  async getEscrowStatus(
    @CurrentUser() user: AuthUser,
    @Param('paymentId') paymentId: string,
  ) {
    const status = await this.paymentsFacade.getEscrowStatusForUser(
      user,
      paymentId,
    );
    return createApiResponse(status);
  }
}
