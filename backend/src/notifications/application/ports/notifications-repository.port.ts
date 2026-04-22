import type {
  NotificationMetadata,
  NotificationType,
  NotificationView,
} from '../../domain/entities/notification.entity';

export const NOTIFICATIONS_REPOSITORY_PORT = Symbol(
  'NOTIFICATIONS_REPOSITORY_PORT',
);

export type CreateNotificationInput = {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  data?: NotificationMetadata;
};

export type ListUserNotificationsQuery = {
  userId: string;
  isRead?: boolean;
  limit: number;
  offset: number;
};

export interface NotificationsRepositoryPort {
  create(input: CreateNotificationInput): Promise<NotificationView>;
  createMany(inputs: CreateNotificationInput[]): Promise<NotificationView[]>;
  listByUser(query: ListUserNotificationsQuery): Promise<NotificationView[]>;
  markAsReadForUser(
    notificationId: string,
    userId: string,
  ): Promise<NotificationView | null>;
  markAllAsReadForUser(userId: string): Promise<number>;
}
