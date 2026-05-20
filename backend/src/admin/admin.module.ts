import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { AdminDashboardService } from './application/services/admin-dashboard.service';
import { AdminMedicalCredentialsService } from './application/services/admin-medical-credentials.service';
import { AdminDashboardController } from './presentation/controllers/admin-dashboard.controller';
import { AdminMedicalCredentialsController } from './presentation/controllers/admin-medical-credentials.controller';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [AdminDashboardController, AdminMedicalCredentialsController],
  providers: [AdminDashboardService, AdminMedicalCredentialsService],
})
export class AdminModule {}
