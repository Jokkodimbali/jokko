import { Inject, Injectable } from '@nestjs/common';
import { appHttpException } from '../../../core/http/app-http.exception';
import {
  type CreateNotificationInput,
  type NotificationsRepositoryPort,
  NOTIFICATIONS_REPOSITORY_PORT,
} from '../ports/notifications-repository.port';
import {
  NOTIFICATION_RECIPIENT_REPOSITORY_PORT,
  type NotificationRecipientRepositoryPort,
} from '../ports/notification-recipient-repository.port';
import { NotificationDeliveryService } from './notification-delivery.service';

export type ListMyNotificationsCommand = {
  userId: string;
  isRead?: boolean;
  limit?: number;
  offset?: number;
};

@Injectable()
export class NotificationsService {
  private readonly defaultLimit = 20;
  private readonly maxLimit = 100;

  constructor(
    @Inject(NOTIFICATIONS_REPOSITORY_PORT)
    private readonly notificationsRepository: NotificationsRepositoryPort,
    @Inject(NOTIFICATION_RECIPIENT_REPOSITORY_PORT)
    private readonly recipientRepository: NotificationRecipientRepositoryPort,
    private readonly deliveryService: NotificationDeliveryService,
  ) {}

  async createInAppNotification(input: CreateNotificationInput) {
    const notification = await this.notificationsRepository.create(input);
    await this.deliveryService.sendPushForNotification(notification);
    return notification;
  }

  async createManyInAppNotifications(
    inputs: CreateNotificationInput[],
  ): Promise<void> {
    if (inputs.length === 0) {
      return;
    }

    const notifications = await this.notificationsRepository.createMany(inputs);
    await Promise.all(
      notifications.map((notification) =>
        this.deliveryService.sendPushForNotification(notification),
      ),
    );
  }

  async listForUser(command: ListMyNotificationsCommand) {
    return this.notificationsRepository.listByUser({
      userId: command.userId,
      isRead: command.isRead,
      limit: this.normalizeLimit(command.limit),
      offset: this.normalizeOffset(command.offset),
    });
  }

  async markAsRead(notificationId: string, userId: string) {
    const notification = await this.notificationsRepository.markAsReadForUser(
      notificationId,
      userId,
    );

    if (!notification) {
      throw appHttpException('NOTIFICATIONS_NOT_FOUND');
    }

    return notification;
  }

  async markAllAsRead(userId: string) {
    const updatedCount =
      await this.notificationsRepository.markAllAsReadForUser(userId);
    return { updatedCount };
  }

  async updateFcmToken(userId: string, fcmToken: string): Promise<void> {
    await this.recipientRepository.updateFcmToken(userId, fcmToken.trim());
  }

  private normalizeLimit(limit?: number): number {
    if (!limit) {
      return this.defaultLimit;
    }

    return Math.min(Math.max(limit, 1), this.maxLimit);
  }

  private normalizeOffset(offset?: number): number {
    if (!offset || offset < 0) {
      return 0;
    }

    return offset;
  }
}
