import { Inject, Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
import { appHttpException } from '../../../core/http/app-http.exception';
import {
  AUTH_REPOSITORY_PORT,
  type AuthRepositoryPort,
} from '../ports/auth-repository.port';

@Injectable()
export class RefreshSessionService {
  constructor(
    @Inject(AUTH_REPOSITORY_PORT)
    private readonly authRepository: AuthRepositoryPort,
  ) {}

  hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  async persist(userId: string, refreshToken: string, expiresAt: Date) {
    const tokenHash = this.hashToken(refreshToken);
    return this.authRepository.createRefreshSession(
      userId,
      tokenHash,
      expiresAt,
    );
  }

  async assertValid(refreshToken: string) {
    const tokenHash = this.hashToken(refreshToken);
    const session =
      await this.authRepository.findActiveSessionByTokenHash(tokenHash);
    if (!session) {
      throw appHttpException('AUTH_REFRESH_TOKEN_INVALID');
    }
    if (session.expireLe.getTime() <= Date.now()) {
      await this.authRepository.revokeSessionById(session.id);
      throw appHttpException('AUTH_REFRESH_TOKEN_INVALID');
    }
    return session;
  }

  async revoke(refreshToken: string): Promise<void> {
    const tokenHash = this.hashToken(refreshToken);
    await this.authRepository.revokeSessionByTokenHash(tokenHash);
  }

  async rotate(
    oldSessionId: string,
    userId: string,
    newRefreshToken: string,
    expiresAt: Date,
  ) {
    const newTokenHash = this.hashToken(newRefreshToken);
    await this.authRepository.rotateSessionToken(
      oldSessionId,
      userId,
      newTokenHash,
      expiresAt,
    );
  }
}
