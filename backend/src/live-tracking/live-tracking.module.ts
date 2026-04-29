import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthModule } from '../auth/auth.module';
import { CoreModule } from '../core/core.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PrismaModule } from '../prisma/prisma.module';
import { ProfessionalsModule } from '../professionals/professionals.module';
import { LIVE_TRACKING_REPOSITORY_PORT } from './application/ports/live-tracking-repository.port';
import { LiveTrackingCommandService } from './application/services/live-tracking-command.service';
import { LiveTrackingFacade } from './application/services/live-tracking-facade.service';
import { LiveTrackingQueryService } from './application/services/live-tracking-query.service';
import { LiveTrackingRepository } from './infrastructure/repositories/live-tracking.repository';
import { LiveTrackingController } from './presentation/controllers/live-tracking.controller';
import { LiveTrackingGateway } from './presentation/gateways/live-tracking.gateway';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    JwtModule,
    CoreModule,
    ProfessionalsModule,
    NotificationsModule,
  ],
  controllers: [LiveTrackingController],
  providers: [
    LiveTrackingRepository,
    {
      provide: LIVE_TRACKING_REPOSITORY_PORT,
      useExisting: LiveTrackingRepository,
    },
    LiveTrackingCommandService,
    LiveTrackingQueryService,
    LiveTrackingFacade,
    LiveTrackingGateway,
  ],
  exports: [LiveTrackingFacade],
})
export class LiveTrackingModule {}
