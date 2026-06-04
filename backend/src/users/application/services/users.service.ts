import { Inject, Injectable } from '@nestjs/common';
import { RoleUtilisateur } from '@prisma/client';
import {
  normalizeEmail,
  normalizeAddress,
} from '../../../shared/utils/string.utils';
import { appHttpException } from '../../../core/http/app-http.exception';
import { PasswordHashService } from '../../../auth/application/services/password-hash.service';
import { PhoneNumberValidator } from '../../../auth/domain/validators/phone-number.validator';
import { DomainValidationError } from '../../../auth/domain/errors/domain-validation.error';
import type { AppMessageKey } from '../../../core/http/app-messages';
import {
  USERS_REPOSITORY_PORT,
  type UserMeView,
  type UsersRepositoryPort,
} from '../ports/users-repository.port';
import type {
  ChangeMyPasswordCommand,
  GetMyHistoryQuery,
  UpdateMyAvatarCommand,
  UpdateMyProfileCommand,
  UpdateMyProfessionalAboutCommand,
  UpdateMyProfessionalExpertiseCommand,
  UploadMyProfessionalCredentialCommand,
} from '../commands/users.commands';

@Injectable()
export class UsersService {
  constructor(
    @Inject(USERS_REPOSITORY_PORT)
    private readonly usersRepository: UsersRepositoryPort,
    private readonly passwordHashService: PasswordHashService,
    private readonly phoneNumberValidator: PhoneNumberValidator,
  ) {}

  async me(userId: string) {
    const user = await this.findUserOrThrow(userId);

    return user;
  }

  async updateMe(userId: string, command: UpdateMyProfileCommand) {
    const existingUser = await this.findUserOrThrow(userId);

    const emailNormalized = normalizeEmail(command.email);
    const phoneNumberNormalized = this.normalizeOptionalPhoneNumber(command.phoneNumber);
    const addressNormalized = normalizeAddress(command.address);

    const payload = {
      nom: command.name?.trim(),
      email: emailNormalized,
      numeroTelephone: phoneNumberNormalized,
      adresse: addressNormalized,
      urlAvatar: command.avatarUrl?.trim(),
    };

    const hasUpdate =
      payload.nom !== undefined ||
      emailNormalized !== undefined ||
      phoneNumberNormalized !== undefined ||
      addressNormalized !== undefined ||
      payload.urlAvatar !== undefined;

    if (!hasUpdate) {
      throw appHttpException('USERS_UPDATE_EMPTY');
    }

    if (
      emailNormalized &&
      emailNormalized !== existingUser.email &&
      (await this.usersRepository.findByEmail(emailNormalized))
    ) {
      throw appHttpException('USERS_EMAIL_ALREADY_USED');
    }
    if (
      phoneNumberNormalized &&
      phoneNumberNormalized !== existingUser.numeroTelephone &&
      (await this.usersRepository.findByPhoneNumber(phoneNumberNormalized))
    ) {
      throw appHttpException('AUTH_PHONE_ALREADY_USED');
    }

    const updatedUser = await this.usersRepository.updateMeById(
      userId,
      payload,
    );
    if (updatedUser.status === 'not_found') {
      throw appHttpException('USERS_USER_NOT_FOUND');
    }
    if (updatedUser.status === 'email_conflict') {
      throw appHttpException('USERS_EMAIL_ALREADY_USED');
    }
    if (updatedUser.status === 'phone_conflict') {
      throw appHttpException('AUTH_PHONE_ALREADY_USED');
    }

    return updatedUser.user;
  }

  async updateMyAvatar(userId: string, command: UpdateMyAvatarCommand) {
    return this.updateMe(userId, { avatarUrl: command.avatarUrl });
  }

  async changeMyPassword(userId: string, command: ChangeMyPasswordCommand) {
    await this.findUserOrThrow(userId);
    const currentHash = await this.usersRepository.findPasswordHashById(userId);
    if (currentHash === undefined) {
      throw appHttpException('USERS_USER_NOT_FOUND');
    }
    if (currentHash) {
      if (!command.currentPassword) {
        throw appHttpException('AUTH_INVALID_CREDENTIALS');
      }

      const isCurrentPasswordValid = await this.passwordHashService.compare(
        command.currentPassword,
        currentHash,
      );
      if (!isCurrentPasswordValid) {
        throw appHttpException('AUTH_INVALID_CREDENTIALS');
      }
    }

    const newHash = await this.passwordHashService.hash(command.newPassword);
    const updated = await this.usersRepository.updatePasswordHashById(
      userId,
      newHash,
    );
    if (!updated) {
      throw appHttpException('USERS_USER_NOT_FOUND');
    }
  }

  async uploadMyProfessionalCredential(
    requestUser: { sub: string; role: RoleUtilisateur },
    command: UploadMyProfessionalCredentialCommand,
  ) {
    if (
      requestUser.role !== RoleUtilisateur.PRESTATAIRE &&
      requestUser.role !== RoleUtilisateur.MEDECIN
    ) {
      throw appHttpException('USERS_PROFESSIONAL_PROFILE_REQUIRED');
    }

    const result = await this.usersRepository.createProfessionalCredentialForUser(
      requestUser.sub,
      command,
    );

    if (result.status === 'professional_profile_not_found') {
      throw appHttpException('USERS_PROFESSIONAL_PROFILE_NOT_FOUND');
    }

    return result.credential;
  }

  async addMyProfessionalExpertise(
    requestUser: { sub: string; role: RoleUtilisateur },
    command: UpdateMyProfessionalExpertiseCommand,
  ) {
    const user = await this.findProfessionalProfileOrThrow(requestUser);
    const currentExpertises = this.extractProfessionalExpertises(
      user.profilProfessionnel?.biographie ?? '',
    );
    const normalized = command.name.trim();
    const exists = currentExpertises.some(
      (item) => item.toLowerCase() === normalized.toLowerCase(),
    );
    const nextExpertises = exists
      ? currentExpertises
      : [...currentExpertises, normalized];

    return this.updateProfessionalExpertises(user, nextExpertises);
  }

  async removeMyProfessionalExpertise(
    requestUser: { sub: string; role: RoleUtilisateur },
    command: UpdateMyProfessionalExpertiseCommand,
  ) {
    const user = await this.findProfessionalProfileOrThrow(requestUser);
    const normalized = command.name.trim().toLowerCase();
    const nextExpertises = this.extractProfessionalExpertises(
      user.profilProfessionnel?.biographie ?? '',
    ).filter((item) => item.toLowerCase() !== normalized);

    return this.updateProfessionalExpertises(user, nextExpertises);
  }

  async updateMyProfessionalAbout(
    requestUser: { sub: string; role: RoleUtilisateur },
    command: UpdateMyProfessionalAboutCommand,
  ) {
    const user = await this.findProfessionalProfileOrThrow(requestUser);
    const currentBiography = user.profilProfessionnel?.biographie ?? '';
    const metadataLines = currentBiography
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => /^(Specialite|Expertises|Documents):/i.test(line));
    const nextBiography = [command.about.trim(), ...metadataLines]
      .filter(Boolean)
      .join('\n');
    const updated = await this.usersRepository.updateProfessionalBiographyForUser(
      user.id,
      nextBiography,
    );

    if (!updated) {
      throw appHttpException('USERS_PROFESSIONAL_PROFILE_NOT_FOUND');
    }

    return updated;
  }

  async deleteMyProfessionalCredential(
    requestUser: { sub: string; role: RoleUtilisateur },
    credentialId: string,
  ) {
    await this.findProfessionalProfileOrThrow(requestUser);
    const result = await this.usersRepository.deleteProfessionalCredentialForUser(
      requestUser.sub,
      credentialId,
    );

    if (result.status === 'professional_profile_not_found') {
      throw appHttpException('USERS_PROFESSIONAL_PROFILE_NOT_FOUND');
    }
    if (result.status === 'credential_not_found') {
      throw appHttpException('USERS_PROFESSIONAL_CREDENTIAL_NOT_FOUND');
    }

    return result.user;
  }

  async listForAdmin(
    requestUser: { role: RoleUtilisateur },
    query: {
      role?: RoleUtilisateur;
      isActive?: boolean;
      search?: string;
      limit?: number;
      offset?: number;
    },
  ) {
    this.assertAdminRole(requestUser.role);
    return this.usersRepository.listAdminUsers(query);
  }

  async getForAdmin(requestUser: { role: RoleUtilisateur }, userId: string) {
    this.assertAdminRole(requestUser.role);
    const user = await this.usersRepository.findAdminUserById(userId);
    if (!user) {
      throw appHttpException('USERS_USER_NOT_FOUND');
    }
    return user;
  }

  async getHistoryForAdmin(
    requestUser: { role: RoleUtilisateur },
    userId: string,
    limit: number,
  ) {
    this.assertAdminRole(requestUser.role);
    const history = await this.usersRepository.getAdminUserHistory(
      userId,
      limit,
    );
    if (!history) {
      throw appHttpException('USERS_USER_NOT_FOUND');
    }
    return history;
  }

  async blockUser(requestUser: { role: RoleUtilisateur }, userId: string) {
    this.assertAdminRole(requestUser.role);
    const user = await this.usersRepository.setUserActiveStatus(userId, false);
    if (!user) {
      throw appHttpException('USERS_USER_NOT_FOUND');
    }
    return user;
  }

  async unblockUser(requestUser: { role: RoleUtilisateur }, userId: string) {
    this.assertAdminRole(requestUser.role);
    const user = await this.usersRepository.setUserActiveStatus(userId, true);
    if (!user) {
      throw appHttpException('USERS_USER_NOT_FOUND');
    }
    return user;
  }

  async getMyHistory(userId: string, query: GetMyHistoryQuery) {
    await this.findUserOrThrow(userId);
    const limit: number = query.limit ?? 20;
    return this.usersRepository.listClientHistory(userId, limit);
  }

  async anonymizeMe(userId: string) {
    await this.findUserOrThrow(userId);
    const anonymized = await this.usersRepository.anonymizeAndRevokeById(
      userId,
      this.buildAnonymizedPhoneNumber(userId),
    );
    if (!anonymized) {
      throw appHttpException('USERS_USER_NOT_FOUND');
    }
  }

  private async findUserOrThrow(userId: string): Promise<UserMeView> {
    const user = await this.usersRepository.findMeById(userId);
    if (!user) {
      throw appHttpException('USERS_USER_NOT_FOUND');
    }
    return user;
  }

  private normalizeOptionalPhoneNumber(
    phoneNumber: string | null | undefined,
  ): string | undefined {
    if (phoneNumber === null || phoneNumber === undefined) {
      return undefined;
    }

    const trimmed = phoneNumber.trim();
    if (!trimmed) {
      return undefined;
    }

    try {
      return this.phoneNumberValidator.normalizeOrThrow(trimmed);
    } catch (error) {
      if (error instanceof DomainValidationError) {
        throw appHttpException(error.code as AppMessageKey);
      }
      throw error;
    }
  }

  private async findProfessionalProfileOrThrow(requestUser: {
    sub: string;
    role: RoleUtilisateur;
  }): Promise<UserMeView> {
    if (
      requestUser.role !== RoleUtilisateur.PRESTATAIRE &&
      requestUser.role !== RoleUtilisateur.MEDECIN
    ) {
      throw appHttpException('USERS_PROFESSIONAL_PROFILE_REQUIRED');
    }

    const user = await this.findUserOrThrow(requestUser.sub);
    if (!user.profilProfessionnel) {
      throw appHttpException('USERS_PROFESSIONAL_PROFILE_NOT_FOUND');
    }

    return user;
  }

  private async updateProfessionalExpertises(
    user: UserMeView,
    expertises: string[],
  ): Promise<UserMeView> {
    const currentBiography = user.profilProfessionnel?.biographie ?? '';
    const nextBiography = this.replaceProfessionalBiographyLine(
      currentBiography,
      'Expertises',
      expertises,
    );
    const updated = await this.usersRepository.updateProfessionalBiographyForUser(
      user.id,
      nextBiography,
    );

    if (!updated) {
      throw appHttpException('USERS_PROFESSIONAL_PROFILE_NOT_FOUND');
    }

    return updated;
  }

  private extractProfessionalExpertises(biography: string): string[] {
    const line = biography
      .split('\n')
      .find((item) => item.toLowerCase().startsWith('expertises:'));
    if (!line) return [];

    return line
      .split(':')
      .slice(1)
      .join(':')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean)
      .slice(0, 20);
  }

  private replaceProfessionalBiographyLine(
    biography: string,
    label: string,
    values: string[],
  ): string | null {
    const lines = biography
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .filter((line) => !line.toLowerCase().startsWith(`${label.toLowerCase()}:`));

    if (values.length > 0) {
      lines.push(`${label}: ${values.join(', ')}`);
    }

    return lines.join('\n') || null;
  }

  private buildAnonymizedPhoneNumber(userId: string): string {
    const suffix = Date.now().toString().slice(-4);
    return `del-${userId.slice(0, 8)}-${suffix}`;
  }

  private assertAdminRole(role: RoleUtilisateur): void {
    if (role !== RoleUtilisateur.ADMIN) {
      throw appHttpException('USERS_ADMIN_FORBIDDEN_ROLE');
    }
  }
}
