import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TECHNICAL_MESSAGES } from '../../../core/messages/technical-message.catalog';
import {
  type EmailNotificationSenderPort,
  type NotificationDeliveryResult,
  type SendEmailNotificationInput,
} from '../../application/ports/notification-delivery.port';

@Injectable()
export class ResendEmailNotificationAdapter implements EmailNotificationSenderPort {
  private readonly logger = new Logger(ResendEmailNotificationAdapter.name);

  constructor(private readonly configService: ConfigService) {}

  async sendEmail(
    input: SendEmailNotificationInput,
  ): Promise<NotificationDeliveryResult> {
    const apiKey = this.configService.get<string>('RESEND_API_KEY');
    const fromAddress = this.configService.get<string>('EMAIL_FROM_ADDRESS');
    const fromName =
      this.configService.get<string>('EMAIL_FROM_NAME') ?? 'Jokko';

    if (!apiKey || !fromAddress) {
      this.logger.warn(
        TECHNICAL_MESSAGES.RESERVATION_EMAIL_PROVIDER_NOT_CONFIGURED,
      );
      return {
        status: 'CONFIGURATION_MANQUANTE',
        provider: 'resend',
        error:
          TECHNICAL_MESSAGES.RESERVATION_EMAIL_PROVIDER_CONFIGURATION_MISSING,
      };
    }

    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: `${fromName} <${fromAddress}>`,
          to: [input.to],
          subject: input.subject,
          text: input.text,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.error(
          TECHNICAL_MESSAGES.RESERVATION_EMAIL_FAILED(errorText),
        );
        return {
          status: 'ECHEC',
          provider: 'resend',
          error: errorText,
        };
      }

      const responseBody = (await response.json()) as { id?: string };
      return {
        status: 'ENVOYE',
        provider: 'resend',
        providerMessageId: responseBody.id ?? null,
        error: null,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : JSON.stringify(error);
      this.logger.error(
        TECHNICAL_MESSAGES.RESERVATION_EMAIL_FAILED(errorMessage),
      );
      return {
        status: 'ECHEC',
        provider: 'resend',
        error: errorMessage,
      };
    }
  }
}
