import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { MediaModule } from '../shared/media/media.module';
import { AdminDashboardService } from './application/services/admin-dashboard.service';
import { AdminArchivesService } from './application/services/admin-archives.service';
import { AdminMedicalCredentialsService } from './application/services/admin-medical-credentials.service';
import { AdminProvidersService } from './application/services/admin-providers.service';
import { AdminRegionsService } from './application/services/admin-regions.service';
import { AdminRevenueService } from './application/services/admin-revenue.service';
import { AdminServiceStructureService } from './application/services/admin-service-structure.service';
import { AdminTrafficAnalyticsService } from './application/services/admin-traffic-analytics.service';
import { AppBannerService } from './application/services/app-banner.service';
import { AppBannersController } from './presentation/controllers/app-banners.controller';
import { AdminDashboardController } from './presentation/controllers/admin-dashboard.controller';
import { AdminArchivesController } from './presentation/controllers/admin-archives.controller';
import { AdminMedicalCredentialsController } from './presentation/controllers/admin-medical-credentials.controller';
import { AdminProvidersController } from './presentation/controllers/admin-providers.controller';
import { AdminRegionsController } from './presentation/controllers/admin-regions.controller';
import { AdminRevenueController } from './presentation/controllers/admin-revenue.controller';
import { AdminServiceStructureController } from './presentation/controllers/admin-service-structure.controller';
import { AdminDeliveryPricingController } from './presentation/controllers/admin-delivery-pricing.controller';
import { MapsModule } from '../maps/maps.module';

@Module({
  imports: [PrismaModule, AuthModule, MediaModule, MapsModule],
  controllers: [
    AppBannersController,
    AdminArchivesController,
    AdminDashboardController,
    AdminMedicalCredentialsController,
    AdminProvidersController,
    AdminRegionsController,
    AdminRevenueController,
    AdminServiceStructureController,
    AdminDeliveryPricingController,
  ],
  providers: [
    AdminArchivesService,
    AdminDashboardService,
    AdminMedicalCredentialsService,
    AdminProvidersService,
    AdminRegionsService,
    AdminRevenueService,
    AdminServiceStructureService,
    AdminTrafficAnalyticsService,
    AppBannerService,
  ],
})
export class AdminModule {}
