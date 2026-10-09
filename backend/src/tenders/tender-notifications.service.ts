import { Injectable, Logger } from '@nestjs/common';
import { TypeNotification } from '@prisma/client';
import { NotificationsService } from '../notifications/application/services/notifications.service';

@Injectable()
export class TenderNotificationsService {
  private readonly logger = new Logger(TenderNotificationsService.name);
  constructor(private readonly notifications: NotificationsService) {}
  async send(tenderId: string, users: string[], title: string, body: string) {
    if (!users.length) return;
    try {
      await this.notifications.createManyInAppNotifications(
        [...new Set(users)].map((userId) => ({
          userId,
          type: TypeNotification.AJUSTEMENT_PRIX_PROPOSE,
          title,
          body,
          data: { tenderId, route: `/appels-offres/${tenderId}` },
        })),
      );
    } catch (error) {
      // The persisted inbox remains authoritative; do not invite duplicate writes on a push failure.
      this.logger.error(`Notification delivery failed for tender ${tenderId}`, error);
    }
  }
}
