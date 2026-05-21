import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { AdminDashboardService } from './application/services/admin-dashboard.service';
import { AdminMedicalCredentialsService } from './application/services/admin-medical-credentials.service';
import { AdminProvidersService } from './application/services/admin-providers.service';
import { AdminRegionsService } from './application/services/admin-regions.service';
import { AdminRevenueService } from './application/services/admin-revenue.service';
import { AdminTrafficAnalyticsService } from './application/services/admin-traffic-analytics.service';
import { AdminDashboardController } from './presentation/controllers/admin-dashboard.controller';
import { AdminMedicalCredentialsController } from './presentation/controllers/admin-medical-credentials.controller';
import { AdminProvidersController } from './presentation/controllers/admin-providers.controller';
import { AdminRegionsController } from './presentation/controllers/admin-regions.controller';
import { AdminRevenueController } from './presentation/controllers/admin-revenue.controller';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [
    AdminDashboardController,
    AdminMedicalCredentialsController,
    AdminProvidersController,
    AdminRegionsController,
    AdminRevenueController,
  ],
  providers: [
    AdminDashboardService,
    AdminMedicalCredentialsService,
    AdminProvidersService,
    AdminRegionsService,
    AdminRevenueService,
    AdminTrafficAnalyticsService,
  ],
})
export class AdminModule {}
