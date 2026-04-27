import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CoreModule } from '../core/core.module';
import { PrismaModule } from '../prisma/prisma.module';
import { ProfessionalsModule } from '../professionals/professionals.module';
import { NEGOTIATIONS_REPOSITORY_PORT } from './application/ports/negotiations-repository.port';
import { NegotiationCommandService } from './application/services/negotiation-command.service';
import { NegotiationQueryService } from './application/services/negotiation-query.service';
import { NegotiationsFacade } from './application/services/negotiations-facade.service';
import { NegotiationsRepository } from './infrastructure/repositories/negotiations.repository';
import { NegotiationsController } from './presentation/controllers/negotiations.controller';

@Module({
  imports: [PrismaModule, AuthModule, CoreModule, ProfessionalsModule],
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
  ],
  exports: [NegotiationsFacade, NEGOTIATIONS_REPOSITORY_PORT],
})
export class NegotiationsModule {}
