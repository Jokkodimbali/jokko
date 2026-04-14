export const OTP_REPOSITORY_PORT = Symbol('OTP_REPOSITORY_PORT');

export type OtpVerificationEntry = {
  id: string;
  phoneNumber: string;
  codeHash: string;
  expiresAt: Date;
  consumedAt: Date | null;
  attempts: number;
  lastSentAt: Date;
};

export interface OtpRepositoryPort {
  findByPhoneNumber(phoneNumber: string): Promise<OtpVerificationEntry | null>;
  upsertForPhoneNumber(data: {
    phoneNumber: string;
    codeHash: string;
    expiresAt: Date;
    lastSentAt: Date;
  }): Promise<void>;
  incrementAttempts(id: string): Promise<void>;
  consume(id: string): Promise<void>;
  delete(id: string): Promise<void>;
}
