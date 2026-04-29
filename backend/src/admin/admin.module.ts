import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { AdminDashboardService } from './application/services/admin-dashboard.service';
import { AdminDashboardController } from './presentation/controllers/admin-dashboard.controller';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [AdminDashboardController],
  providers: [AdminDashboardService],
})
export class AdminModule {}
