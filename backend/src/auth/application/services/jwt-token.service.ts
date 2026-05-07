import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { RoleUtilisateur } from '@prisma/client';
import { randomUUID } from 'node:crypto';

type JwtPayload = {
  sub: string;
  role: RoleUtilisateur;
  phoneNumber: string;
};

function ttlToSeconds(ttl: string): number {
  const numeric = Number(ttl);
  if (!Number.isNaN(numeric)) {
    return numeric;
  }

  const match = new RegExp(/^(\d+)([smhd])$/i).exec(ttl);
  if (!match) {
    return 900;
  }

  const value = Number(match[1]);
  const unit = match[2].toLowerCase();
  switch (unit) {
    case 's':
      return value;
    case 'm':
      return value * 60;
    case 'h':
      return value * 3600;
    case 'd':
      return value * 86400;
    default:
      return 900;
  }
}

@Injectable()
export class JwtTokenService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async issueTokens(payload: JwtPayload) {
    const accessTtl = ttlToSeconds(
      this.configService.get<string>('JWT_ACCESS_TTL') ?? '15m',
    );
    const refreshTtl = ttlToSeconds(
      this.configService.get<string>('JWT_REFRESH_TTL') ?? '30d',
    );

    const accessToken = await this.jwtService.signAsync(payload, {
      secret: this.configService.get<string>('JWT_ACCESS_SECRET'),
      expiresIn: accessTtl,
    });
    const refreshToken = await this.jwtService.signAsync(payload, {
      secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      expiresIn: refreshTtl,
      jwtid: randomUUID(),
    });

    return { accessToken, refreshToken };
  }

  async verifyRefreshToken(token: string): Promise<JwtPayload> {
    return this.jwtService.verifyAsync<JwtPayload>(token, {
      secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
    });
  }

  getRefreshTokenExpiryDate(): Date {
    const refreshTtl = ttlToSeconds(
      this.configService.get<string>('JWT_REFRESH_TTL') ?? '30d',
    );
    return new Date(Date.now() + refreshTtl * 1000);
  }

  getAccessTokenMaxAgeMs(): number {
    const accessTtl = ttlToSeconds(
      this.configService.get<string>('JWT_ACCESS_TTL') ?? '15m',
    );
    return accessTtl * 1000;
  }

  getRefreshTokenMaxAgeMs(): number {
    const refreshTtl = ttlToSeconds(
      this.configService.get<string>('JWT_REFRESH_TTL') ?? '30d',
    );
    return refreshTtl * 1000;
  }
}
