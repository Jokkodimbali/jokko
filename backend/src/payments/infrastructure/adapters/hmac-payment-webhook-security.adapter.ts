import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { type PaymentWebhookSecurityPort } from '../../application/ports/payment-webhook-security.port';

const FIVE_MINUTES_IN_SECONDS = 300;

@Injectable()
export class HmacPaymentWebhookSecurityAdapter implements PaymentWebhookSecurityPort {
  constructor(private readonly configService: ConfigService) {}

  verifySignature(params: {
    rawPayload: string;
    signature?: string;
    timestamp?: string;
  }): boolean {
    const secret = this.configService.get<string>('PAYMENT_WEBHOOK_SECRET');
    if (!secret) {
      return true;
    }

    if (!params.signature || !params.timestamp) {
      return false;
    }

    const timestamp = Number(params.timestamp);
    if (!Number.isFinite(timestamp)) {
      return false;
    }

    const nowInSeconds = Math.floor(Date.now() / 1000);
    if (Math.abs(nowInSeconds - timestamp) > FIVE_MINUTES_IN_SECONDS) {
      return false;
    }

    const signedPayload = `${params.timestamp}.${params.rawPayload}`;
    const expected = createHmac('sha256', secret)
      .update(signedPayload)
      .digest('hex');

    const expectedBuffer = Buffer.from(expected, 'hex');
    const receivedBuffer = Buffer.from(params.signature, 'hex');

    if (expectedBuffer.length !== receivedBuffer.length) {
      return false;
    }

    return timingSafeEqual(expectedBuffer, receivedBuffer);
  }
}
