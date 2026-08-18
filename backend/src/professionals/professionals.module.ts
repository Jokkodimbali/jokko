import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { SearchModule } from '../search/search.module';
import { MediaModule } from '../shared/media/media.module';
import { ProfessionalsController } from './presentation/controllers/professionals.controller';
import { AdminKycController } from './presentation/controllers/admin-kyc.controller';
import { ProfessionalsRepository } from './infrastructure/repositories/professionals.repository';
import { PROFESSIONALS_REPOSITORY_PORT } from './application/ports/professionals-repository.port';
import { ProfileService } from './application/services/profile.service';
import { KycService } from './application/services/kyc.service';
import { ServiceManagementService } from './application/services/service-management.service';
import { PortfolioService } from './application/services/portfolio.service';
import { AvailabilityService } from './application/services/availability.service';
import { ProfessionalsFacade } from './application/services/professionals-facade.service';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    SearchModule,
    MediaModule,
    NotificationsModule,
  ],
  controllers: [ProfessionalsController, AdminKycController],
  providers: [
    // Infrastructure
    ProfessionalsRepository,
    {
      provide: PROFESSIONALS_REPOSITORY_PORT,
      useExisting: ProfessionalsRepository,
    },
    // Application services
    ProfileService,
    KycService,
    ServiceManagementService,
    PortfolioService,
    AvailabilityService,
    // Facade (orchestration layer)
    ProfessionalsFacade,
  ],
  exports: [ProfessionalsFacade, PROFESSIONALS_REPOSITORY_PORT],
})
export class ProfessionalsModule {}
