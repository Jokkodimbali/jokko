import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiParam,
} from '@nestjs/swagger';
import { RoleUtilisateur } from '@prisma/client';
import { CurrentUser } from '../../../auth/security/current-user.decorator';
import type { AuthUser } from '../../../auth/security/auth-user.type';
import { JwtAuthGuard } from '../../../auth/security/jwt-auth.guard';
import { Roles, RolesGuard } from '../../../shared/guards/roles.guard';
import { createApiResponse } from '../../../shared/dto/api-response.dto';
import { PaymentsFacade } from '../../application/services/payments-facade.service';
import { ListPaymentsQueryDto } from '../dto/list-payments-query.dto';
import { appMessage } from '../../../core/http/app-http.exception';
import { API_DOCS } from '../../../core/messages/api-docs.messages';

@ApiTags(API_DOCS.adminPayments?.tag || 'Administration - Paiements')
@ApiBearerAuth()
@Controller('admin/payments')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AdminPaymentsController {
  constructor(private readonly paymentsFacade: PaymentsFacade) {}

  @Get()
  @Roles(RoleUtilisateur.ADMIN)
  @ApiOperation({ summary: API_DOCS.adminPayments.listSummary })
  async listAllPayments(
    @CurrentUser() user: AuthUser,
    @Query() query: ListPaymentsQueryDto,
  ) {
    const allClientPayments = await this.paymentsFacade.getClientPaymentHistory(
      '',
      query,
    );
    const allProfessionalPayments =
      await this.paymentsFacade.getProfessionalPaymentHistory('', query);

    return createApiResponse({
      clientPayments: allClientPayments,
      professionalPayments: allProfessionalPayments,
    });
  }

  @Get('statistics')
  @Roles(RoleUtilisateur.ADMIN)
  @ApiOperation({ summary: API_DOCS.adminPayments.statisticsSummary })
  async getPaymentStatistics() {
    // Statistiques générales
    const pendingEscrowReleases =
      await this.paymentsFacade.getPendingEscrowReleases();

    const stats = {
      pendingEscrowReleases: pendingEscrowReleases.length,
      totalEscrowAmount: pendingEscrowReleases.reduce(
        (sum, payment) => sum + payment.netAmount.getValue(),
        0,
      ),
      totalPayments: 0,
      totalRevenue: 0,
    };

    return createApiResponse(stats);
  }

  @Get(':paymentId')
  @Roles(RoleUtilisateur.ADMIN)
  @ApiOperation({ summary: API_DOCS.adminPayments.getByIdSummary })
  @ApiParam({
    name: 'paymentId',
    description: API_DOCS.payments.paymentIdParam,
  })
  async getPaymentDetails(
    @CurrentUser() user: AuthUser,
    @Param('paymentId') paymentId: string,
  ) {
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
  async refundPayment(
    @CurrentUser() user: AuthUser,
    @Param('paymentId') paymentId: string,
    @Body() body: { reason?: string },
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
  async processPendingEscrowReleases() {
    const payments = await this.paymentsFacade.getPendingEscrowReleases();

    const processedPayments = [];
    const failedPayments = [];

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
          error instanceof Error ? error.message : 'Unknown error';
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
