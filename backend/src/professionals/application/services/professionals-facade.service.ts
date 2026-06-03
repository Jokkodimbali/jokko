import { Injectable, Inject } from '@nestjs/common';
import type { AuthUser } from '../../../auth/security/auth-user.type';
import { ProfileService } from './profile.service';
import { KycService } from './kyc.service';
import { ServiceManagementService } from './service-management.service';
import { PortfolioService } from './portfolio.service';
import { AvailabilityService } from './availability.service';
import {
  PROFESSIONALS_REPOSITORY_PORT,
  type ProfessionalReviewView,
  type ProfessionalsRepositoryPort,
} from '../ports/professionals-repository.port';

/**
 * Application Facade for the Professionals module.
 *
 * This facade orchestrates cross-cutting concerns between sub-services
 * and provides a unified API surface for controllers.
 * While it delegates most calls, it ensures:
 * - Consistent error handling across services
 * - Transaction boundaries (when needed in future)
 * - Caching layer (when needed in future)
 * - Logging/audit trails
 */
@Injectable()
export class ProfessionalsFacade {
  constructor(
    private readonly profileService: ProfileService,
    private readonly kycService: KycService,
    private readonly serviceManagementService: ServiceManagementService,
    private readonly portfolioService: PortfolioService,
    private readonly availabilityService: AvailabilityService,
    @Inject(PROFESSIONALS_REPOSITORY_PORT)
    private readonly professionalsRepository: ProfessionalsRepositoryPort,
  ) {}

  // ─── Profile ───────────────────────────────────────────────────────────────

  async createProfile(
    requestUser: AuthUser,
    command: Parameters<ProfileService['createProfile']>[1],
  ) {
    return this.profileService.createProfile(requestUser, command);
  }

  async me(requestUser: AuthUser) {
    return this.profileService.getMyProfile(requestUser);
  }

  async updateMyProfile(
    requestUser: AuthUser,
    command: Parameters<ProfileService['updateMyProfile']>[1],
  ) {
    return this.profileService.updateMyProfile(requestUser, command);
  }

  async getProfessionalById(profileId: string) {
    return this.profileService.getProfessionalById(profileId);
  }

  // ─── KYC ───────────────────────────────────────────────────────────────────

  async submitKyc(
    requestUser: AuthUser,
    command: Parameters<KycService['submitKyc']>[1],
  ) {
    return this.kycService.submitKyc(requestUser, command);
  }

  async listKycForAdmin(
    requestUser: AuthUser,
    query?: Parameters<KycService['listKycForAdmin']>[1],
  ) {
    return this.kycService.listKycForAdmin(requestUser, query);
  }

  async getKycByIdForAdmin(requestUser: AuthUser, profileId: string) {
    return this.kycService.getKycByIdForAdmin(requestUser, profileId);
  }

  async approveKyc(requestUser: AuthUser, profileId: string) {
    return this.kycService.approveKyc(requestUser, profileId);
  }

  async rejectKyc(
    requestUser: AuthUser,
    profileId: string,
    command: Parameters<KycService['rejectKyc']>[2],
  ) {
    return this.kycService.rejectKyc(requestUser, profileId, command);
  }

  // ─── Services ──────────────────────────────────────────────────────────────

  async createMyService(
    requestUser: AuthUser,
    command: Parameters<ServiceManagementService['createService']>[1],
  ) {
    return this.serviceManagementService.createService(requestUser, command);
  }

  async updateMyService(
    requestUser: AuthUser,
    serviceId: string,
    command: Parameters<ServiceManagementService['updateService']>[2],
  ) {
    return this.serviceManagementService.updateService(
      requestUser,
      serviceId,
      command,
    );
  }

  async disableMyService(requestUser: AuthUser, serviceId: string) {
    return this.serviceManagementService.disableService(requestUser, serviceId);
  }

  async listMyServices(requestUser: AuthUser) {
    return this.serviceManagementService.listMyServices(requestUser);
  }

  async listProfessionalServices(profileId: string) {
    return this.serviceManagementService.listServicesByProfile(profileId);
  }

  // ─── Portfolio ─────────────────────────────────────────────────────────────

  async createMyPortfolioItem(
    requestUser: AuthUser,
    command: Parameters<PortfolioService['createItem']>[1],
  ) {
    return this.portfolioService.createItem(requestUser, command);
  }

  async deleteMyPortfolioItem(requestUser: AuthUser, itemId: string) {
    return this.portfolioService.deleteItem(requestUser, itemId);
  }

  async listProfessionalPortfolio(profileId: string) {
    return this.portfolioService.listByProfile(profileId);
  }

  // ─── Availabilities ────────────────────────────────────────────────────────

  async createMyAvailability(
    requestUser: AuthUser,
    command: Parameters<AvailabilityService['createAvailability']>[1],
  ) {
    return this.availabilityService.createAvailability(requestUser, command);
  }

  async disableMyAvailability(requestUser: AuthUser, availabilityId: string) {
    return this.availabilityService.disableAvailability(
      requestUser,
      availabilityId,
    );
  }

  async updateMyAvailability(
    requestUser: AuthUser,
    availabilityId: string,
    command: Parameters<AvailabilityService['updateAvailability']>[2],
  ) {
    return this.availabilityService.updateAvailability(
      requestUser,
      availabilityId,
      command,
    );
  }

  async listMyAvailabilities(requestUser: AuthUser) {
    return this.availabilityService.listMyAvailabilities(requestUser);
  }

  async listProfessionalAvailabilities(profileId: string) {
    return this.availabilityService.listByProfile(profileId);
  }

  // ─── Reviews ───────────────────────────────────────────────────────────────

  async listProfessionalReviews(
    profileId: string,
  ): Promise<ProfessionalReviewView[]> {
    return this.professionalsRepository.listReviews(profileId);
  }
}
