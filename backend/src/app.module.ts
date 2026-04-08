import { Module } from '@nestjs/common';
import { CoreModule } from './core/core.module';
import { PrismaModule } from './prisma/prisma.module';
import { SanteModule } from './sante/sante.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [CoreModule, PrismaModule, SanteModule, AuthModule, UsersModule],
})
export class AppModule {}
