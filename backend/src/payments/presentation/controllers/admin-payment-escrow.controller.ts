import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { RoleUtilisateur } from '@prisma/client';
import { JwtAuthGuard } from '../../../auth/security/jwt-auth.guard';
import { appMessage } from '../../../core/http/app-http.exception';
import { API_DOCS } from '../../../core/messages/api-docs.messages';
import { createApiResponse } from '../../../shared/dto/api-response.dto';
import { Roles, RolesGuard } from '../../../shared/guards/roles.guard';
import { ApiStandardSuccessResponse } from '../../../shared/swagger/api-response-swagger.dto';
import { SWAGGER_RESPONSE_EXAMPLES } from '../../../shared/swagger/swagger-response.examples';
import { PaymentsFacade } from '../../application/services/payments-facade.service';

@ApiTags(API_DOCS.adminPayments.tag)
@ApiBearerAuth()
@Controller('admin/payments/escrow')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AdminPaymentEscrowController {
  constructor(private readonly paymentsFacade: PaymentsFacade) {}

  @Get('pending')
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

  @Post('process-pending')
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
