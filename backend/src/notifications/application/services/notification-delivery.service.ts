import { Inject, Injectable, Logger } from '@nestjs/common';
import { TECHNICAL_MESSAGES } from '../../../core/messages/technical-message.catalog';
import type { NotificationView } from '../../domain/entities/notification.entity';
import {
  EMAIL_NOTIFICATION_SENDER_PORT,
  type EmailNotificationSenderPort,
  type NotificationDeliveryResult,
  PUSH_NOTIFICATION_SENDER_PORT,
  type PushNotificationSenderPort,
  SMS_NOTIFICATION_SENDER_PORT,
  type SmsNotificationSenderPort,
} from '../ports/notification-delivery.port';
import {
  NOTIFICATION_RECIPIENT_REPOSITORY_PORT,
  type NotificationRecipientRepositoryPort,
} from '../ports/notification-recipient-repository.port';

@Injectable()
export class NotificationDeliveryService {
  private readonly logger = new Logger(NotificationDeliveryService.name);

  constructor(
    @Inject(EMAIL_NOTIFICATION_SENDER_PORT)
    private readonly emailSender: EmailNotificationSenderPort,
    @Inject(SMS_NOTIFICATION_SENDER_PORT)
    private readonly smsSender: SmsNotificationSenderPort,
    @Inject(PUSH_NOTIFICATION_SENDER_PORT)
    private readonly pushSender: PushNotificationSenderPort,
    @Inject(NOTIFICATION_RECIPIENT_REPOSITORY_PORT)
    private readonly recipientRepository: NotificationRecipientRepositoryPort,
  ) {}

  async sendEmail(input: {
    to: string;
    subject: string;
    text: string;
  }): Promise<NotificationDeliveryResult> {
    return this.emailSender.sendEmail(input);
  }

  async sendSms(input: {
    to: string;
    body: string;
  }): Promise<NotificationDeliveryResult> {
    return this.smsSender.sendSms(input);
  }

  async sendPushForNotification(notification: NotificationView): Promise<void> {
    const recipient = await this.recipientRepository.findById(
      notification.userId,
    );
    if (!recipient?.fcmToken) {
      return;
    }

    const result = await this.pushSender.sendPush({
      token: recipient.fcmToken,
      title: notification.title,
      body: notification.body,
      data: notification.data,
    });

    if (result.status !== 'ENVOYE') {
      this.logger.warn(
        TECHNICAL_MESSAGES.NOTIFICATION_PUSH_DELIVERY_SKIPPED(
          result.error ?? result.status,
        ),
      );
    }
  }
}
