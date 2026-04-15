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
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(AuditLoggerMiddleware).forRoutes('*');
  }
}
