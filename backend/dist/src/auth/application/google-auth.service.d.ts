import { ConfigService } from '@nestjs/config';
import { type TokenPayload } from 'google-auth-library';
export declare class GoogleAuthService {
    private readonly configService;
    private readonly client;
    constructor(configService: ConfigService);
    verifyIdToken(idToken: string): Promise<TokenPayload>;
}
