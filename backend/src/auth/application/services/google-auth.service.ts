import { Injectable } from '@nestjs/common';
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

    const ticket = await this.client.verifyIdToken({
      idToken,
      audience,
    });
    const payload = ticket.getPayload();
    if (!payload) {
      throw appHttpException('AUTH_GOOGLE_ACCOUNT_INVALID');
    }
    return payload;
  }
}
