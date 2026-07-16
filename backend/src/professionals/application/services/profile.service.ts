import { Injectable } from '@nestjs/common';
import { appHttpException } from '../../../core/http/app-http.exception';
import type { AuthUser } from '../../../auth/security/auth-user.type';
import { Bio, City, CompanyName } from '../../domain';
import type {
  CreateProfessionalProfileCommand,
  UpdateProfessionalProfileCommand,
} from '../commands/professionals.commands';
import { ProfessionalAppService } from './professional-app-service.base';

const SENEGAL_BOUNDS = {
  minLatitude: 12.0,
  maxLatitude: 17.0,
  minLongitude: -18.0,
  maxLongitude: -11.0,
} as const;

@Injectable()
export class ProfileService extends ProfessionalAppService {
  async createProfile(
    requestUser: AuthUser,
    command: CreateProfessionalProfileCommand,
  ) {
    this.assertProfessionalRole(requestUser.role);

    const result = await this.professionalsRepository.createProfile({
      utilisateurId: requestUser.sub,
      biographie: Bio.create(command.bio)?.getValue() ?? null,
      nomEntreprise:
        CompanyName.create(command.companyName)?.getValue() ?? null,
      ville: City.create(command.city)?.getValue() ?? null,
      typeVehicule: command.vehicleType,
      ...this.normalizeLocation(command),
    });

    if (result.status === 'already_exists') {
      throw appHttpException('PROFESSIONALS_PROFILE_ALREADY_EXISTS');
    }
    if (result.status === 'user_not_found') {
      throw appHttpException('AUTH_USER_NOT_FOUND');
    }

    return result.profile;
  }

  async getMyProfile(requestUser: AuthUser) {
    this.assertProfessionalRole(requestUser.role);
    return this.ensureProfessionalProfile(requestUser.sub);
  }

  async updateMyProfile(
    requestUser: AuthUser,
    command: UpdateProfessionalProfileCommand,
  ) {
    this.assertProfessionalRole(requestUser.role);
    this.assertNonEmptyUpdate(command as Record<string, unknown>);

    const result = await this.professionalsRepository.updateProfile({
      utilisateurId: requestUser.sub,
      biographie:
        command.bio === undefined
          ? undefined
          : (Bio.create(command.bio)?.getValue() ?? null),
      nomEntreprise:
        command.companyName === undefined
          ? undefined
          : (CompanyName.create(command.companyName)?.getValue() ?? null),
      ville:
        command.city === undefined
          ? undefined
          : (City.create(command.city)?.getValue() ?? null),
      typeVehicule: command.vehicleType,
      ...this.normalizeLocation(command),
    });

    if (result.status === 'profile_not_found') {
      throw appHttpException('PROFESSIONALS_PROFILE_NOT_FOUND');
    }

    return result.profile;
  }

  async getProfessionalById(profileId: string) {
    const profile =
      await this.professionalsRepository.findPublicById(profileId);
    if (!profile) {
      throw appHttpException('PROFESSIONALS_PROFILE_NOT_FOUND');
    }
    return profile;
  }

  private normalizeLocation(command: {
    latitude?: number | null;
    longitude?: number | null;
  }): { latitude?: number | null; longitude?: number | null } {
    const hasLatitude = command.latitude !== undefined;
    const hasLongitude = command.longitude !== undefined;
    if (!hasLatitude && !hasLongitude) return {};
    if (hasLatitude !== hasLongitude) {
      throw appHttpException('SEARCH_COORDINATES_PAIR_REQUIRED');
    }

    if (
      command.latitude === null ||
      command.longitude === null ||
      command.latitude === undefined ||
      command.longitude === undefined
    ) {
      return { latitude: null, longitude: null };
    }

    if (!this.isCoordinateInSenegal(command.latitude, command.longitude)) {
      throw appHttpException('MAPS_COORDINATES_INVALID');
    }

    return {
      latitude: command.latitude,
      longitude: command.longitude,
    };
  }

  private isCoordinateInSenegal(latitude: number, longitude: number): boolean {
    return (
      Number.isFinite(latitude) &&
      Number.isFinite(longitude) &&
      latitude >= SENEGAL_BOUNDS.minLatitude &&
      latitude <= SENEGAL_BOUNDS.maxLatitude &&
      longitude >= SENEGAL_BOUNDS.minLongitude &&
      longitude <= SENEGAL_BOUNDS.maxLongitude
    );
  }
}
