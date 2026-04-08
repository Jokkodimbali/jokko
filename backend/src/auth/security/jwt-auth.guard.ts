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
    const authHeader = request.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      throw appHttpException('AUTH_TOKEN_MISSING');
    }

    const token = authHeader.slice(7);
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
}
