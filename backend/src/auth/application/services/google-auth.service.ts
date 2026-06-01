import { HttpException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OAuth2Client, type TokenPayload } from 'google-auth-library';
import { appHttpException } from '../../../core/http/app-http.exception';

@Injectable()
export class GoogleAuthService {
  private readonly client = new OAuth2Client();

  constructor(private readonly configService: ConfigService) {}

  async verifyIdToken(idToken: string): Promise<TokenPayload> {
    const audience = this.configService.get<string>('GOOGLE_CLIENT_ID');
    if (!audience) {
      throw appHttpException('AUTH_GOOGLE_NOT_CONFIGURED');
    }

    try {
      const ticket = await this.client.verifyIdToken({
        idToken,
        audience,
      });
      const payload = ticket.getPayload();
      if (!payload || payload.email_verified !== true) {
        throw appHttpException('AUTH_GOOGLE_ACCOUNT_INVALID');
      }
      return payload;
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw appHttpException('AUTH_GOOGLE_ACCOUNT_INVALID');
    }
  }
}
