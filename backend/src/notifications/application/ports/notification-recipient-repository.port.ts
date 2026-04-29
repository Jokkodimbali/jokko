export const NOTIFICATION_RECIPIENT_REPOSITORY_PORT = Symbol(
  'NOTIFICATION_RECIPIENT_REPOSITORY_PORT',
);

export type NotificationRecipient = {
  id: string;
  fcmToken: string | null;
};

export type NotificationBroadcastTarget = 'CLIENT' | 'PRESTATAIRE' | 'ALL';

export interface NotificationRecipientRepositoryPort {
  findById(userId: string): Promise<NotificationRecipient | null>;
  updateFcmToken(userId: string, fcmToken: string): Promise<void>;
  listRecipientsForBroadcast(
    target: NotificationBroadcastTarget,
  ): Promise<NotificationRecipient[]>;
}
