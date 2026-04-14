import { Inject, Injectable } from '@nestjs/common';
import {
  normalizeEmail,
  normalizeAddress,
} from '../../../shared/utils/string.utils';
import { appHttpException } from '../../../core/http/app-http.exception';
import {
  USERS_REPOSITORY_PORT,
  type UserMeView,
  type UsersRepositoryPort,
} from '../ports/users-repository.port';
import type {
  GetMyHistoryQuery,
  UpdateMyAvatarCommand,
  UpdateMyProfileCommand,
} from '../commands/users.commands';

@Injectable()
export class UsersService {
  constructor(
    @Inject(USERS_REPOSITORY_PORT)
    private readonly usersRepository: UsersRepositoryPort,
  ) {}

  async me(userId: string) {
    const user = await this.findUserOrThrow(userId);

    return user;
  }

  async updateMe(userId: string, command: UpdateMyProfileCommand) {
    const existingUser = await this.findUserOrThrow(userId);

    const emailNormalized = normalizeEmail(command.email);
    const addressNormalized = normalizeAddress(command.address);

    const payload = {
      nom: command.name?.trim(),
      email: emailNormalized,
      adresse: addressNormalized,
      urlAvatar: command.avatarUrl?.trim(),
    };

    const hasUpdate =
      payload.nom !== undefined ||
      emailNormalized !== undefined ||
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

    return updatedUser.user;
  }

  async updateMyAvatar(userId: string, command: UpdateMyAvatarCommand) {
    return this.updateMe(userId, { avatarUrl: command.avatarUrl });
  }

  async getMyHistory(userId: string, query: GetMyHistoryQuery) {
    await this.findUserOrThrow(userId);
    const limit: number = query.limit ?? 20;
    return this.usersRepository.listClientHistory(userId, limit);
  }

  async anonymizeMe(userId: string) {
    await this.findUserOrThrow(userId);
    const replacementPhoneNumber = this.buildAnonymizedPhoneNumber(userId);
    const anonymized = await this.usersRepository.anonymizeAndRevokeById(
      userId,
      replacementPhoneNumber,
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

  private buildAnonymizedPhoneNumber(userId: string): string {
    const suffix = Date.now().toString().slice(-4);
    return `del-${userId.slice(0, 8)}-${suffix}`;
  }
}
