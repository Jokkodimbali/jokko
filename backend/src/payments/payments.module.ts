import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaModule } from '../prisma/prisma.module';
import { SharedModule } from '../shared/shared.module';
import { PaymentsController } from './presentation/controllers/payments.controller';
import { AdminPaymentsController } from './presentation/controllers/admin-payments.controller';
import { PaymentCommandService } from './application/services/payment-command.service';
import { PaymentQueryService } from './application/services/payment-query.service';
import { PaymentsFacade } from './application/services/payments-facade.service';
import { EscrowService } from './application/services/escrow.service';
import { WithdrawalService } from './application/services/withdrawal.service';
import { PaymentsRepositoryImpl } from './infrastructure/repositories/payments.repository';
import { WithdrawalsRepositoryImpl } from './infrastructure/repositories/withdrawals.repository';
import { PaymentWorkflowRepository } from './infrastructure/repositories/payment-workflow.repository';
import { PaymentIdempotencyRepository } from './infrastructure/repositories/payment-idempotency.repository';
import { PaymentWebhookEventRepository } from './infrastructure/repositories/payment-webhook-event.repository';
import { WalletLedgerRepository } from './infrastructure/repositories/wallet-ledger.repository';
import { MockPaymentGatewayAdapter } from './infrastructure/adapters/mock-payment-gateway.adapter';
import { HmacPaymentWebhookSecurityAdapter } from './infrastructure/adapters/hmac-payment-webhook-security.adapter';

import { PAYMENTS_REPOSITORY_PORT } from './application/ports/payments-repository.port';
import { PAYMENT_GATEWAY_PORT } from './application/ports/payment-gateway.port';
import { WITHDRAWALS_REPOSITORY_PORT } from './application/ports/withdrawals-repository.port';
import { PAYMENT_WORKFLOW_PORT } from './application/ports/payment-workflow.port';
import { PAYMENT_IDEMPOTENCY_PORT } from './application/ports/payment-idempotency.port';
import { PAYMENT_WEBHOOK_EVENT_PORT } from './application/ports/payment-webhook-event.port';
import { PAYMENT_WEBHOOK_SECURITY_PORT } from './application/ports/payment-webhook-security.port';
import { WALLET_LEDGER_PORT } from './application/ports/wallet-ledger.port';
import {
  DOMAIN_EVENT_DISPATCHER,
  DomainEventDispatcher,
} from '../shared/domain/events/domain-event-dispatcher';
import { ReservationsModule } from '../reservations/reservations.module';
import { ProfessionalsModule } from '../professionals/professionals.module';

@Module({
  imports: [
    PrismaModule,
    SharedModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_ACCESS_SECRET'),
      }),
    }),
    ReservationsModule,
    ProfessionalsModule,
  ],
  controllers: [PaymentsController, AdminPaymentsController],
  providers: [
    DomainEventDispatcher,
    {
      provide: DOMAIN_EVENT_DISPATCHER,
      useExisting: DomainEventDispatcher,
    },
    PaymentCommandService,
    PaymentQueryService,
    PaymentsFacade,
    EscrowService,
    WithdrawalService,
    {
      provide: PAYMENTS_REPOSITORY_PORT,
      useClass: PaymentsRepositoryImpl,
    },
    {
      provide: PAYMENT_GATEWAY_PORT,
      useClass: MockPaymentGatewayAdapter,
    },

    {
      provide: WITHDRAWALS_REPOSITORY_PORT,
      useClass: WithdrawalsRepositoryImpl,
    },
    {
      provide: PAYMENT_WORKFLOW_PORT,
      useClass: PaymentWorkflowRepository,
    },
    {
      provide: PAYMENT_IDEMPOTENCY_PORT,
      useClass: PaymentIdempotencyRepository,
    },
    {
      provide: PAYMENT_WEBHOOK_EVENT_PORT,
      useClass: PaymentWebhookEventRepository,
    },
    {
      provide: PAYMENT_WEBHOOK_SECURITY_PORT,
      useClass: HmacPaymentWebhookSecurityAdapter,
    },
    {
      provide: WALLET_LEDGER_PORT,
      useClass: WalletLedgerRepository,
    },
  ],
  exports: [PaymentsFacade],
})
export class PaymentsModule {}
