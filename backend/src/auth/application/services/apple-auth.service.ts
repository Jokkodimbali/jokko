import { createPublicKey, verify } from 'crypto';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { appHttpException } from '../../../core/http/app-http.exception';

type AppleJwtHeader = { alg?: string; kid?: string };
type AppleTokenPayload = {
  iss?: string;
  aud?: string | string[];
  exp?: number;
  sub?: string;
  email?: string;
  email_verified?: boolean | string;
};

type AppleJwk = JsonWebKey & { kid?: string; alg?: string; use?: string };

@Injectable()
export class AppleAuthService {
  private keys: AppleJwk[] = [];
  private keysExpireAt = 0;

  constructor(private readonly configService: ConfigService) {}

  async verifyIdToken(
    idToken: string,
  ): Promise<Required<Pick<AppleTokenPayload, 'sub' | 'email'>>> {
    const audience = this.configService.get<string>('APPLE_CLIENT_ID');
    if (!audience) {
      throw appHttpException('AUTH_APPLE_NOT_CONFIGURED');
    }

    try {
      const parts = idToken.split('.');
      if (parts.length !== 3) throw new Error('Malformed Apple identity token');

      const header = this.decodeJson<AppleJwtHeader>(parts[0]);
      const payload = this.decodeJson<AppleTokenPayload>(parts[1]);
      if (header.alg !== 'RS256' || !header.kid)
        throw new Error('Unsupported Apple token');

      const key = await this.getSigningKey(header.kid);
      const isSignatureValid = verify(
        'RSA-SHA256',
        Buffer.from(`${parts[0]}.${parts[1]}`),
        createPublicKey({ key, format: 'jwk' }),
        this.decodeBase64Url(parts[2]),
      );

      const now = Math.floor(Date.now() / 1000);
      const audienceMatches = Array.isArray(payload.aud)
        ? payload.aud.includes(audience)
        : payload.aud === audience;
      const emailVerified =
        payload.email_verified === true || payload.email_verified === 'true';

      if (
        !isSignatureValid ||
        payload.iss !== 'https://appleid.apple.com' ||
        !audienceMatches ||
        !payload.exp ||
        payload.exp <= now ||
        !payload.sub ||
        !payload.email ||
        !emailVerified
      ) {
        throw new Error('Invalid Apple identity token claims');
      }

      return { sub: payload.sub, email: payload.email.toLowerCase() };
    } catch {
      throw appHttpException('AUTH_APPLE_ACCOUNT_INVALID');
    }
  }

  private async getSigningKey(kid: string): Promise<AppleJwk> {
    if (Date.now() >= this.keysExpireAt) {
      const response = await fetch('https://appleid.apple.com/auth/keys');
      if (!response.ok) throw new Error('Apple signing keys unavailable');
      const body = (await response.json()) as { keys?: AppleJwk[] };
      this.keys = body.keys ?? [];
      this.keysExpireAt = Date.now() + 60 * 60 * 1000;
    }

    const key = this.keys.find(
      (candidate) => candidate.kid === kid && candidate.alg === 'RS256',
    );
    if (!key) {
      this.keysExpireAt = 0;
      throw new Error('Unknown Apple signing key');
    }
    return key;
  }

  private decodeJson<T>(value: string): T {
    return JSON.parse(this.decodeBase64Url(value).toString('utf8')) as T;
  }

  private decodeBase64Url(value: string): Buffer {
    return Buffer.from(value, 'base64url');
  }
}
