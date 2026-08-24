import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PharmacyOrdersService } from './application/pharmacy-orders.service';
import { PharmacyOrdersController } from './presentation/pharmacy-orders.controller';
import { PaymentsModule } from '../payments/payments.module';
import { MapsModule } from '../maps/maps.module';

@Module({
  imports: [
    AuthModule,
    PrismaModule,
    NotificationsModule,
    PaymentsModule,
    MapsModule,
  ],
  controllers: [PharmacyOrdersController],
  providers: [PharmacyOrdersService],
  exports: [PharmacyOrdersService],
})
export class PharmacyOrdersModule {}
