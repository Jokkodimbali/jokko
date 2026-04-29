import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { ProfessionalsModule } from '../professionals/professionals.module';
import { UsersModule } from '../users/users.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { NegotiationsModule } from '../negotiations/negotiations.module';
import { DisputesModule } from '../disputes/disputes.module';
import { LiveTrackingModule } from '../live-tracking/live-tracking.module';
import { RESERVATIONS_REPOSITORY_PORT } from './application/ports/reservations-repository.port';
import { ReservationCommandService } from './application/services/reservation-command.service';
import { ReservationQueryService } from './application/services/reservation-query.service';
import { ReservationsFacade } from './application/services/reservations-facade.service';
import { ReservationsRepository } from './infrastructure/repositories/reservations.repository';
import { AdminReservationsController } from './presentation/controllers/admin-reservations.controller';
import { ReservationsController } from './presentation/controllers/reservations.controller';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    ProfessionalsModule,
    UsersModule,
    NotificationsModule,
    NegotiationsModule,
    DisputesModule,
    LiveTrackingModule,
  ],
  controllers: [ReservationsController, AdminReservationsController],
  providers: [
    ReservationsRepository,
    {
      provide: RESERVATIONS_REPOSITORY_PORT,
      useExisting: ReservationsRepository,
    },
    ReservationCommandService,
    ReservationQueryService,
    ReservationsFacade,
  ],
  exports: [ReservationsFacade, RESERVATIONS_REPOSITORY_PORT],
})
export class ReservationsModule {}
