import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { RoleUtilisateur } from '@prisma/client';
type JwtPayload = {
    sub: string;
    role: RoleUtilisateur;
    phoneNumber: string;
};
export declare class JwtTokenService {
    private readonly jwtService;
    private readonly configService;
    constructor(jwtService: JwtService, configService: ConfigService);
    issueTokens(payload: JwtPayload): Promise<{
        accessToken: string;
        refreshToken: string;
    }>;
    verifyRefreshToken(token: string): Promise<JwtPayload>;
    getRefreshTokenExpiryDate(): Date;
}
export {};
