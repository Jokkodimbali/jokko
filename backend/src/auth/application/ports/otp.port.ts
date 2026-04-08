export const OTP_PORT = Symbol('OTP_PORT');

export interface OtpPort {
  create(phoneNumber: string): Promise<{ expiresInSeconds: number }>;
  verify(phoneNumber: string, code: string): Promise<boolean>;
}
