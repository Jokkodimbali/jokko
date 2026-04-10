import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { CoreModule } from './core/core.module';
import { PrismaModule } from './prisma/prisma.module';
import { SanteModule } from './sante/sante.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { AuditLoggerMiddleware } from './core/audit/audit-logger.middleware';

@Module({
  imports: [CoreModule, PrismaModule, SanteModule, AuthModule, UsersModule],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(AuditLoggerMiddleware).forRoutes('*');
  }
}
