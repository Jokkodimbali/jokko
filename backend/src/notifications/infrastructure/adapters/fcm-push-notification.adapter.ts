import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleAuth } from 'google-auth-library';
import { TECHNICAL_MESSAGES } from '../../../core/messages/technical-message.catalog';
import {
  type NotificationDeliveryResult,
  type PushNotificationSenderPort,
  type SendPushNotificationInput,
} from '../../application/ports/notification-delivery.port';

@Injectable()
export class FcmPushNotificationAdapter implements PushNotificationSenderPort {
  private readonly logger = new Logger(FcmPushNotificationAdapter.name);

  constructor(private readonly configService: ConfigService) {}

  async sendPush(
    input: SendPushNotificationInput,
  ): Promise<NotificationDeliveryResult> {
    const projectId = this.configService.get<string>('FCM_PROJECT_ID');
    const clientEmail = this.configService.get<string>('FCM_CLIENT_EMAIL');
    const privateKey = this.normalizePrivateKey(
      this.configService.get<string>('FCM_PRIVATE_KEY'),
    );

    if (!projectId || !clientEmail || !privateKey) {
      return {
        status: 'CONFIGURATION_MANQUANTE',
        provider: 'fcm',
        error:
          TECHNICAL_MESSAGES.NOTIFICATION_FCM_PROVIDER_CONFIGURATION_MISSING,
      };
    }

    try {
      const auth = new GoogleAuth({
        credentials: {
          client_email: clientEmail,
          private_key: privateKey,
        },
        scopes: ['https://www.googleapis.com/auth/firebase.messaging'],
      });
      const client = await auth.getClient();
      const accessToken = await client.getAccessToken();
      const token = accessToken.token;

      if (!token) {
        return {
          status: 'ECHEC',
          provider: 'fcm',
          error: TECHNICAL_MESSAGES.NOTIFICATION_FCM_TOKEN_MISSING,
        };
      }

      const response = await fetch(
        `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            message: {
              token: input.token,
              notification: {
                title: input.title,
                body: input.body,
              },
              data: this.toFcmData(input.data),
            },
          }),
        },
      );

      if (!response.ok) {
        const errorText = await response.text();
        this.logger.error(
          TECHNICAL_MESSAGES.NOTIFICATION_FCM_FAILED(errorText),
        );
        return {
          status: 'ECHEC',
          provider: 'fcm',
          error: errorText,
        };
      }

      const responseBody = (await response.json()) as { name?: string };
      return {
        status: 'ENVOYE',
        provider: 'fcm',
        providerMessageId: responseBody.name ?? null,
        error: null,
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : JSON.stringify(error);
      this.logger.error(
        TECHNICAL_MESSAGES.NOTIFICATION_FCM_FAILED(errorMessage),
      );
      return {
        status: 'ECHEC',
        provider: 'fcm',
        error: errorMessage,
      };
    }
  }

  private normalizePrivateKey(value?: string): string {
    return value?.replace(/\\n/g, '\n') ?? '';
  }

  private toFcmData(
    data?: Record<string, unknown> | null,
  ): Record<string, string> {
    if (!data) {
      return {};
    }

    return Object.fromEntries(
      Object.entries(data).map(([key, value]) => [key, String(value)]),
    );
  }
}
