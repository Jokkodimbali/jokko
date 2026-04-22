import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TECHNICAL_MESSAGES } from '../../../core/messages/technical-message.catalog';
import {
  type NotificationDeliveryResult,
  type SendSmsNotificationInput,
  type SmsNotificationSenderPort,
} from '../../application/ports/notification-delivery.port';

@Injectable()
export class TwilioSmsNotificationAdapter implements SmsNotificationSenderPort {
  private readonly logger = new Logger(TwilioSmsNotificationAdapter.name);

  constructor(private readonly configService: ConfigService) {}

  async sendSms(
    input: SendSmsNotificationInput,
  ): Promise<NotificationDeliveryResult> {
    const accountSid = this.configService.get<string>('TWILIO_ACCOUNT_SID');
    const authToken = this.configService.get<string>('TWILIO_AUTH_TOKEN');
    const fromPhoneNumber = this.configService.get<string>(
      'TWILIO_PHONE_NUMBER',
    );

    if (!accountSid || !authToken || !fromPhoneNumber) {
      this.logger.warn(
        TECHNICAL_MESSAGES.RESERVATION_SMS_PROVIDER_NOT_CONFIGURED,
      );
      return {
        status: 'CONFIGURATION_MANQUANTE',
        provider: 'twilio',
        error:
          TECHNICAL_MESSAGES.RESERVATION_SMS_PROVIDER_CONFIGURATION_MISSING,
      };
    }

    try {
      const payload = new URLSearchParams({
        To: input.to,
        From: fromPhoneNumber,
        Body: input.body,
      });
      const authorization = Buffer.from(`${accountSid}:${authToken}`).toString(
        'base64',
      );

      const response = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
        {
          method: 'POST',
          headers: {
            Authorization: `Basic ${authorization}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: payload,
        },
      );

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.error(TECHNICAL_MESSAGES.RESERVATION_SMS_FAILED(errorText));
        return {
          status: 'ECHEC',
          provider: 'twilio',
          error: errorText,
        };
      }

      const responseBody = (await response.json()) as { sid?: string };
      return {
        status: 'ENVOYE',
        provider: 'twilio',
        providerMessageId: responseBody.sid ?? null,
        error: null,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : JSON.stringify(error);
      this.logger.error(
        TECHNICAL_MESSAGES.RESERVATION_SMS_FAILED(errorMessage),
      );
      return {
        status: 'ECHEC',
        provider: 'twilio',
        error: errorMessage,
      };
    }
  }
}
