import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
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

@Module({
  imports: [PrismaModule],
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
  exports: [ProfessionalsFacade],
})
export class ProfessionalsModule {}
