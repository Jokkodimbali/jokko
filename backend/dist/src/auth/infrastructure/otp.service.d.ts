import { OtpRepository } from './repositories/otp.repository';
import type { OtpPort } from '../application/ports/otp.port';
export declare class OtpService implements OtpPort {
    private readonly otpRepository;
    private readonly ttlMs;
    private readonly maxAttempts;
    private readonly resendCooldownMs;
    constructor(otpRepository: OtpRepository);
    private hashCode;
    create(phoneNumber: string): Promise<{
        expiresInSeconds: number;
    }>;
    verify(phoneNumber: string, code: string): Promise<boolean>;
}
