import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CoreModule } from '../core/core.module';
import { PrismaModule } from '../prisma/prisma.module';
import { ProfessionalsModule } from '../professionals/professionals.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { NEGOTIATIONS_REPOSITORY_PORT } from './application/ports/negotiations-repository.port';
import { NegotiationCommandService } from './application/services/negotiation-command.service';
import { NegotiationQueryService } from './application/services/negotiation-query.service';
import { NegotiationsFacade } from './application/services/negotiations-facade.service';
import { MaterialQuoteService } from './application/services/material-quote.service';
import { NegotiationsRepository } from './infrastructure/repositories/negotiations.repository';
import { NegotiationsController } from './presentation/controllers/negotiations.controller';
import { NegotiationsGateway } from './presentation/gateways/negotiations.gateway';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    CoreModule,
    ProfessionalsModule,
    NotificationsModule,
  ],
  controllers: [NegotiationsController],
  providers: [
    NegotiationsRepository,
    {
      provide: NEGOTIATIONS_REPOSITORY_PORT,
      useExisting: NegotiationsRepository,
    },
    NegotiationCommandService,
    NegotiationQueryService,
    NegotiationsFacade,
    MaterialQuoteService,
    NegotiationsGateway,
  ],
  exports: [NegotiationsFacade, NEGOTIATIONS_REPOSITORY_PORT],
})
export class NegotiationsModule {}
