import {
  Body,
  Controller,
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
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser } from '../../../auth/security/current-user.decorator';
import type { AuthUser } from '../../../auth/security/auth-user.type';
import { JwtAuthGuard } from '../../../auth/security/jwt-auth.guard';
import { createApiResponse } from '../../../shared/dto/api-response.dto';
import { PaymentsFacade } from '../../application/services/payments-facade.service';
import { PaymentWebhookDto } from '../dto/payment-webhook.dto';
import { InitiatePaymentDto } from '../dto/initiate-payment.dto';
import { RequestWithdrawalDto } from '../dto/request-withdrawal.dto';
import { ListPaymentsQueryDto } from '../dto/list-payments-query.dto';
import { PaymentReasonDto } from '../dto/payment-reason.dto';
import { API_DOCS } from '../../../core/messages/api-docs.messages';
import { appMessage } from '../../../core/http/app-http.exception';

@ApiTags(API_DOCS.payments.tag)
@ApiBearerAuth()
@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsFacade: PaymentsFacade) {}

  @Post('initiate')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: API_DOCS.payments.initiateSummary })
  @ApiResponse({
    status: 201,
    description: API_DOCS.payments.paymentInitiated,
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
  @ApiResponse({
    status: 200,
    description: API_DOCS.payments.webhookProcessed,
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
  async getWithdrawalHistory(@CurrentUser() user: AuthUser) {
    const withdrawals =
      await this.paymentsFacade.getProfessionalWithdrawalsForUser(user);
    return createApiResponse(withdrawals);
  }

  @Post('withdraw')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: API_DOCS.payments.withdrawSummary })
  @ApiResponse({
    status: 201,
    description: API_DOCS.payments.withdrawalCreated,
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

  @Get(':paymentId')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: API_DOCS.payments.getByIdSummary })
  @ApiParam({
    name: 'paymentId',
    description: API_DOCS.payments.paymentIdParam,
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
