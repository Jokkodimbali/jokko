import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { MapsModule } from '../maps/maps.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PrismaModule } from '../prisma/prisma.module';
import { PaymentsModule } from '../payments/payments.module';
import { MaterialOrdersService } from './application/material-orders.service';
import { MaterialOrdersController } from './presentation/material-orders.controller';

@Module({
  imports: [
    AuthModule,
    PrismaModule,
    NotificationsModule,
    MapsModule,
    PaymentsModule,
  ],
  controllers: [MaterialOrdersController],
  providers: [MaterialOrdersService],
  exports: [MaterialOrdersService],
})
export class MaterialOrdersModule {}
