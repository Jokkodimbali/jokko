import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { ProfessionalsModule } from '../professionals/professionals.module';
import { RESERVATIONS_REPOSITORY_PORT } from './application/ports/reservations-repository.port';
import { ReservationsRepository } from './infrastructure/repositories/reservations.repository';
import { ReservationsFacade } from './application/services/reservations-facade.service';
import { ReservationsController } from './presentation/controllers/reservations.controller';
import { AdminReservationsController } from './presentation/controllers/admin-reservations.controller';

@Module({
  imports: [PrismaModule, AuthModule, ProfessionalsModule],
  controllers: [ReservationsController, AdminReservationsController],
  providers: [
    ReservationsRepository,
    {
      provide: RESERVATIONS_REPOSITORY_PORT,
      useExisting: ReservationsRepository,
    },
    ReservationsFacade,
  ],
  exports: [ReservationsFacade],
})
export class ReservationsModule {}
