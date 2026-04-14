import { Inject, Injectable } from '@nestjs/common';
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

    const payload = {
      nom: command.name?.trim(),
      email: this.normalizeEmail(command.email),
      adresse: this.normalizeAddress(command.address),
      urlAvatar: command.avatarUrl?.trim(),
    };

    if (
      payload.nom === undefined &&
      payload.email === undefined &&
      payload.adresse === undefined &&
      payload.urlAvatar === undefined
    ) {
      throw appHttpException('USERS_UPDATE_EMPTY');
    }

    if (
      payload.email &&
      payload.email !== existingUser.email &&
      (await this.usersRepository.findByEmail(payload.email))
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

  private normalizeEmail(
    email: string | null | undefined,
  ): string | null | undefined {
    if (email === undefined || email === null) {
      return email;
    }

    const normalized = email.trim().toLowerCase();
    if (normalized.length === 0) {
      return null;
    }
    return normalized;
  }

  private normalizeAddress(
    value: string | null | undefined,
  ): string | null | undefined {
    if (value === undefined || value === null) {
      return value;
    }

    const normalized = value.trim();
    return normalized.length === 0 ? null : normalized;
  }

  private buildAnonymizedPhoneNumber(userId: string): string {
    const suffix = Date.now().toString().slice(-4);
    return `del-${userId.slice(0, 8)}-${suffix}`;
  }
}
