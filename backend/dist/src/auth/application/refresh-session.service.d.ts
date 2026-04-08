import { type AuthRepositoryPort } from './ports/auth-repository.port';
export declare class RefreshSessionService {
    private readonly authRepository;
    constructor(authRepository: AuthRepositoryPort);
    hashToken(token: string): string;
    persist(userId: string, refreshToken: string, expiresAt: Date): Promise<unknown>;
    assertValid(refreshToken: string): Promise<import("./ports/auth-repository.port").AuthRefreshSession>;
    revoke(refreshToken: string): Promise<void>;
    rotate(oldSessionId: string, userId: string, newRefreshToken: string, expiresAt: Date): Promise<void>;
}
