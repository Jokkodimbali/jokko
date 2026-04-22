import type { NotificationMetadata } from '../../domain/entities/notification.entity';

export const EMAIL_NOTIFICATION_SENDER_PORT = Symbol(
  'EMAIL_NOTIFICATION_SENDER_PORT',
);
export const SMS_NOTIFICATION_SENDER_PORT = Symbol(
  'SMS_NOTIFICATION_SENDER_PORT',
);
export const PUSH_NOTIFICATION_SENDER_PORT = Symbol(
  'PUSH_NOTIFICATION_SENDER_PORT',
);

export type NotificationDeliveryStatus =
  | 'ENVOYE'
  | 'ECHEC'
  | 'CONFIGURATION_MANQUANTE';

export type NotificationDeliveryResult = {
  status: NotificationDeliveryStatus;
  provider: string;
  providerMessageId?: string | null;
  error?: string | null;
};

export type SendEmailNotificationInput = {
  to: string;
  subject: string;
  text: string;
};

export type SendSmsNotificationInput = {
  to: string;
  body: string;
};

export type SendPushNotificationInput = {
  token: string;
  title: string;
  body: string;
  data?: NotificationMetadata | null;
};

export interface EmailNotificationSenderPort {
  sendEmail(
    input: SendEmailNotificationInput,
  ): Promise<NotificationDeliveryResult>;
}

export interface SmsNotificationSenderPort {
  sendSms(input: SendSmsNotificationInput): Promise<NotificationDeliveryResult>;
}

export interface PushNotificationSenderPort {
  sendPush(
    input: SendPushNotificationInput,
  ): Promise<NotificationDeliveryResult>;
}
