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
import { PaymentGatewayService } from './application/services/payment-gateway.service';
import { WithdrawalService } from './application/services/withdrawal.service';
import { PaymentsRepositoryImpl } from './infrastructure/repositories/payments.repository';
import { WithdrawalsRepositoryImpl } from './infrastructure/repositories/withdrawals.repository';
import { MockPaymentGatewayAdapter } from './infrastructure/adapters/mock-payment-gateway.adapter';

import { PAYMENTS_REPOSITORY_PORT } from './application/ports/payments-repository.port';
import { PAYMENT_GATEWAY_PORT } from './application/ports/payment-gateway.port';
import { WITHDRAWALS_REPOSITORY_PORT } from './application/ports/withdrawals-repository.port';
import {
  DOMAIN_EVENT_DISPATCHER,
  DomainEventDispatcher,
} from '../shared/domain/events/domain-event-dispatcher';

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
    PaymentGatewayService,
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
  ],
  exports: [PaymentsFacade, PaymentGatewayService],
})
export class PaymentsModule {}
