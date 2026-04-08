import { HttpException, Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
import { OtpRepository } from './repositories/otp.repository';
import {
  appHttpException,
  appMessage,
} from '../../core/http/app-http.exception';
import type { OtpPort } from '../application/ports/otp.port';

@Injectable()
export class OtpService implements OtpPort {
  private readonly ttlMs = 5 * 60 * 1000;
  private readonly maxAttempts = 5;
  private readonly resendCooldownMs = 60 * 1000;
  constructor(private readonly otpRepository: OtpRepository) {}

  private hashCode(code: string): string {
    return createHash('sha256').update(code).digest('hex');
  }

  async create(phoneNumber: string): Promise<{ expiresInSeconds: number }> {
    const existing = await this.otpRepository.findByPhoneNumber(phoneNumber);
    if (
      existing &&
      Date.now() - existing.dernierEnvoiLe.getTime() < this.resendCooldownMs
    ) {
      const message = appMessage('AUTH_OTP_RESEND_TOO_EARLY');
      throw new HttpException(
        {
          message: message.message,
          errorCode: message.code,
        },
        message.httpStatus,
      );
    }

    const code = String(Math.floor(100000 + Math.random() * 900000));
    await this.otpRepository.upsertForPhoneNumber({
      phoneNumber,
      codeHash: this.hashCode(code),
      expiresAt: new Date(Date.now() + this.ttlMs),
      lastSentAt: new Date(),
    });

    // TODO: brancher le provider SMS (Twilio/Infobip) ici.

    return {
      expiresInSeconds: Math.floor(this.ttlMs / 1000),
    };
  }

  async verify(phoneNumber: string, code: string): Promise<boolean> {
    const entry = await this.otpRepository.findByPhoneNumber(phoneNumber);
    if (!entry) {
      throw appHttpException('AUTH_OTP_INVALID_OR_EXPIRED');
    }

    if (entry.consommeLe || Date.now() > entry.expireLe.getTime()) {
      await this.otpRepository.delete(entry.id);
      throw appHttpException('AUTH_OTP_INVALID_OR_EXPIRED');
    }

    if (entry.tentatives >= this.maxAttempts) {
      await this.otpRepository.delete(entry.id);
      const message = appMessage('AUTH_OTP_TOO_MANY_REQUESTS');
      throw new HttpException(
        {
          message: message.message,
          errorCode: message.code,
        },
        message.httpStatus,
      );
    }

    const inputHash = this.hashCode(code);
    if (entry.hashCode !== inputHash) {
      await this.otpRepository.incrementAttempts(entry.id);
      throw appHttpException('AUTH_OTP_INVALID_OR_EXPIRED');
    }

    await this.otpRepository.consume(entry.id);
    return true;
  }
}
