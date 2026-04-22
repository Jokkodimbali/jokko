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
    NotificationsModule,
    ReservationsModule,
    PaymentsModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(AuditLoggerMiddleware).forRoutes('*');
  }
}
