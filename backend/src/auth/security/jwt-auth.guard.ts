import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { AuthUser } from './auth-user.type';
import { appHttpException } from '../../core/http/app-http.exception';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{
      headers: Record<string, string | undefined>;
      user?: AuthUser;
    }>();
    const token = this.extractToken(request.headers);
    if (!token) {
      throw appHttpException('AUTH_TOKEN_MISSING');
    }

    try {
      const payload = await this.jwtService.verifyAsync<AuthUser>(token, {
        secret: this.configService.get<string>('JWT_ACCESS_SECRET'),
      });
      request.user = payload;
      return true;
    } catch {
      throw appHttpException('AUTH_TOKEN_INVALID');
    }
  }

  private extractToken(headers: Record<string, string | undefined>): string | null {
    const authHeader = headers.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      return authHeader.slice(7);
    }

    const cookieHeader = headers.cookie;
    if (!cookieHeader) return null;

    const cookie = cookieHeader
      .split(';')
      .map((part) => part.trim())
      .find((part) => part.startsWith('jokko_access_token='));

    return cookie ? decodeURIComponent(cookie.split('=').slice(1).join('=')) : null;
  }
}
