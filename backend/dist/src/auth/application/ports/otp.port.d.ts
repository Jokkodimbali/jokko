export declare const OTP_PORT: unique symbol;
export interface OtpPort {
    create(phoneNumber: string): Promise<{
        expiresInSeconds: number;
    }>;
    verify(phoneNumber: string, code: string): Promise<boolean>;
}
