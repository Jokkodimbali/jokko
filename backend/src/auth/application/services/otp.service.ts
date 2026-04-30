import { Inject, Injectable } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { appHttpException } from '../../../core/http/app-http.exception';
import {
  OTP_REPOSITORY_PORT,
  type OtpRepositoryPort,
} from '../ports/otp-repository.port';

@Injectable()
export class OtpService {
  private readonly ttlMs = 5 * 60 * 1000;
  private readonly maxAttempts = 5;
  private readonly resendCooldownMs = 60 * 1000;
  constructor(
    @Inject(OTP_REPOSITORY_PORT)
    private readonly otpRepository: OtpRepositoryPort,
  ) {}

  private hashCode(code: string): string {
    return createHash('sha256').update(code).digest('hex');
  }

  async create(phoneNumber: string): Promise<{ expiresInSeconds: number }> {
    const existing = await this.otpRepository.findByPhoneNumber(phoneNumber);
    if (
      existing &&
      Date.now() - existing.lastSentAt.getTime() < this.resendCooldownMs
    ) {
      throw appHttpException('AUTH_OTP_RESEND_TOO_EARLY');
    }

    const code = '123456'; // Fixed code for development testing
    await this.otpRepository.upsertForPhoneNumber({
      phoneNumber,
      codeHash: code,
      expiresAt: new Date(Date.now() + this.ttlMs),
      lastSentAt: new Date(),
    });

    // brancher le provider SMS (Twilio/Infobip) ici.

    return {
      expiresInSeconds: Math.floor(this.ttlMs / 1000),
    };
  }

  async verify(phoneNumber: string, code: string): Promise<boolean> {
    const entry = await this.otpRepository.findByPhoneNumber(phoneNumber);
    if (!entry) {
      throw appHttpException('AUTH_OTP_INVALID_OR_EXPIRED');
    }

    if (entry.consumedAt || Date.now() > entry.expiresAt.getTime()) {
      await this.otpRepository.delete(entry.id);
      throw appHttpException('AUTH_OTP_INVALID_OR_EXPIRED');
    }

    if (entry.attempts >= this.maxAttempts) {
      await this.otpRepository.delete(entry.id);
      throw appHttpException('AUTH_OTP_TOO_MANY_REQUESTS');
    }

    // For development testing, compare plain code
    if (entry.codeHash !== code) {
      await this.otpRepository.incrementAttempts(entry.id);
      throw appHttpException('AUTH_OTP_INVALID_OR_EXPIRED');
    }

    await this.otpRepository.consume(entry.id);
    return true;
  }
}
