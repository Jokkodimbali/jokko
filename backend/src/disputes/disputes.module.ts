import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PrismaModule } from '../prisma/prisma.module';
import { DISPUTES_REPOSITORY_PORT } from './application/ports/disputes-repository.port';
import { DisputeCommandService } from './application/services/dispute-command.service';
import { DisputeMediationMessageService } from './application/services/dispute-mediation-message.service';
import { DisputeQueryService } from './application/services/dispute-query.service';
import { DisputesFacade } from './application/services/disputes-facade.service';
import { DisputesRepository } from './infrastructure/repositories/disputes.repository';
import { AdminDisputesController } from './presentation/controllers/admin-disputes.controller';

@Module({
  imports: [PrismaModule, NotificationsModule, AuthModule],
  controllers: [AdminDisputesController],
  providers: [
    DisputesRepository,
    {
      provide: DISPUTES_REPOSITORY_PORT,
      useExisting: DisputesRepository,
    },
    DisputeCommandService,
    DisputeMediationMessageService,
    DisputeQueryService,
    DisputesFacade,
  ],
  exports: [DisputesFacade],
})
export class DisputesModule {}
