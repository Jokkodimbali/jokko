import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { UsersController } from './presentation/controllers/users.controller';
import { AdminUsersController } from './presentation/controllers/admin-users.controller';
import { UsersService } from './application/services/users.service';
import { UsersMedicalProfileService } from './application/services/users-medical-profile.service';
import { UsersRepository } from './infrastructure/repositories/users.repository';
import { USERS_REPOSITORY_PORT } from './application/ports/users-repository.port';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [UsersController, AdminUsersController],
  providers: [
    UsersService,
    UsersMedicalProfileService,
    UsersRepository,
    {
      provide: USERS_REPOSITORY_PORT,
      useExisting: UsersRepository,
    },
  ],
  exports: [USERS_REPOSITORY_PORT],
})
export class UsersModule {}
