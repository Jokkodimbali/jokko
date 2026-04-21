import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { CurrentUser } from '../../../auth/security/current-user.decorator';
import type { AuthUser } from '../../../auth/security/auth-user.type';
import { JwtAuthGuard } from '../../../auth/security/jwt-auth.guard';
import { appMessage } from '../../../core/http/app-http.exception';
import { createApiResponse } from '../../../shared/dto/api-response.dto';
import { PaymentsFacade } from '../../application/services/payments-facade.service';
import { PaymentDomainError } from '../../domain/errors/payment.domain-error';
import { PaymentWebhookDto } from '../dto/payment-webhook.dto';
import { InitiatePaymentDto } from '../dto/initiate-payment.dto';
import { RequestWithdrawalDto } from '../dto/request-withdrawal.dto';
import { ListPaymentsQueryDto } from '../dto/list-payments-query.dto';
import { PaymentStatus } from '../../domain/value-objects/payment-types.vo';
import { API_DOCS } from '../../../core/messages/api-docs.messages';

@ApiTags(API_DOCS.payments.tag)
@ApiBearerAuth()
@Controller('payments')
@UseGuards(JwtAuthGuard)
export class PaymentsController {
  constructor(private readonly paymentsFacade: PaymentsFacade) {}

  @Post('initiate')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: API_DOCS.payments.initiateSummary })
  @ApiResponse({
    status: 201,
    description: API_DOCS.payments.paymentInitiated,
  })
  async initiatePayment(
    @CurrentUser() user: AuthUser,
    @Body() dto: InitiatePaymentDto,
  ) {
    const bookingInfo = {
      clientId: user.sub,
      professionalId: 'professional-id',
      amount: 10000,
    };

    const result = await this.paymentsFacade.initiatePayment({
      bookingId: dto.bookingId,
      clientId: bookingInfo.clientId,
      professionalId: bookingInfo.professionalId,
      amount: bookingInfo.amount,
      method: dto.method,
      callbackUrl: dto.callbackUrl,
      successUrl: dto.successUrl,
      cancelUrl: dto.cancelUrl,
    });

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
    const { invoice_token, status } = webhookData;

    if (invoice_token && status) {
      const paymentStatus =
        status === 'completed'
          ? PaymentStatus.SUCCESS
          : status === 'cancelled'
            ? PaymentStatus.CANCELLED
            : PaymentStatus.FAILED;

      await this.paymentsFacade.processPaymentWebhook(
        webhookData.gatewayReference || invoice_token,
        paymentStatus,
      );
      return createApiResponse(
        null,
        appMessage('PAYMENTS_WEBHOOK_PROCESSED').message,
      );
    }

    return createApiResponse({ received: true });
  }

  @Get('history')
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

  @Get(':paymentId')
  @ApiOperation({ summary: "Détail d'un paiement" })
  @ApiParam({
    name: 'paymentId',
    description: 'ID du paiement',
  })
  async getPaymentDetails(
    @CurrentUser() user: AuthUser,
    @Param('paymentId') paymentId: string,
  ) {
    const payment = await this.paymentsFacade.getPaymentById(paymentId);

    if (payment.clientId !== user.sub && payment.professionalId !== user.sub) {
      throw PaymentDomainError.unauthorizedAccess(paymentId);
    }

    return createApiResponse(payment.toView());
  }

  @Post('withdraw')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Demander un retrait de fonds (professionnel)' })
  @ApiResponse({
    status: 201,
    description: 'Demande de retrait créée avec succès',
  })
  async requestWithdrawal(
    @CurrentUser() user: AuthUser,
    @Body() dto: RequestWithdrawalDto,
  ) {
    const walletBalance = 50000;

    const withdrawal = await this.paymentsFacade.requestWithdrawal({
      professionalId: user.sub,
      amount: dto.amount,
      method: dto.method,
      walletBalance,
    });

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

  @Get('withdrawals')
  @ApiOperation({ summary: 'Historique des retraits (professionnel)' })
  async getWithdrawalHistory(@CurrentUser() user: AuthUser) {
    const withdrawals = await this.paymentsFacade.getProfessionalWithdrawals(
      user.sub,
    );
    return createApiResponse(withdrawals);
  }

  @Patch(':paymentId/escrow/release')
  @ApiOperation({
    summary: 'Libérer les fonds escrow (après validation prestation)',
  })
  @ApiParam({
    name: 'paymentId',
    description: 'ID du paiement',
  })
  async releaseEscrow(
    @CurrentUser() user: AuthUser,
    @Param('paymentId') paymentId: string,
  ) {
    const payment = await this.paymentsFacade.releaseEscrow(paymentId);

    return createApiResponse(
      {
        payment: payment.toView(),
        escrowReleased: true,
      },
      appMessage('PAYMENTS_ESCROW_RELEASED').message,
    );
  }

  @Patch(':paymentId/escrow/dispute')
  @ApiOperation({ summary: 'Contester un paiement (ouvrir un litige)' })
  @ApiParam({
    name: 'paymentId',
    description: 'ID du paiement',
  })
  async disputeEscrow(
    @CurrentUser() user: AuthUser,
    @Param('paymentId') paymentId: string,
    @Body() body: { reason?: string },
  ) {
    const payment = await this.paymentsFacade.disputeEscrow(
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
  @ApiOperation({ summary: "Statut du escrow d'un paiement" })
  @ApiParam({
    name: 'paymentId',
    description: 'ID du paiement',
  })
  async getEscrowStatus(
    @CurrentUser() user: AuthUser,
    @Param('paymentId') paymentId: string,
  ) {
    const status = await this.paymentsFacade.getEscrowStatus(paymentId);
    return createApiResponse(status);
  }
}
