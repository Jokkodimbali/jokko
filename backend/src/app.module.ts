import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { CoreModule } from './core/core.module';
import { PrismaModule } from './prisma/prisma.module';
import { SanteModule } from './sante/sante.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { SharedModule } from './shared/shared.module';
import { AuditLoggerMiddleware } from './core/audit/audit-logger.middleware';
import { ProfessionalsModule } from './professionals/professionals.module';
import { CategoriesModule } from './categories/categories.module';
import { ReservationsModule } from './reservations/reservations.module';
import { PaymentsModule } from './payments/payments.module';
import { NotificationsModule } from './notifications/notifications.module';
import { NegotiationsModule } from './negotiations/negotiations.module';
import { SearchModule } from './search/search.module';
import { MessagingModule } from './messaging/messaging.module';
import { DisputesModule } from './disputes/disputes.module';
import { LiveTrackingModule } from './live-tracking/live-tracking.module';
import { AdminModule } from './admin/admin.module';
import { FavoritesModule } from './favorites/favorites.module';
import { MapsModule } from './maps/maps.module';

@Module({
  imports: [
    SharedModule,
    CoreModule,
    PrismaModule,
    SanteModule,
    AuthModule,
    UsersModule,
    ProfessionalsModule,
    CategoriesModule,
    NegotiationsModule,
    NotificationsModule,
    DisputesModule,
    MessagingModule,
    LiveTrackingModule,
    AdminModule,
    FavoritesModule,
    MapsModule,
    SearchModule,
    ReservationsModule,
    PaymentsModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(AuditLoggerMiddleware).forRoutes('*');
  }
}
