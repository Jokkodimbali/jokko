import { Inject, Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { RoleUtilisateur } from '@prisma/client';
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

const NOTIFICATION_TEXT_REPLACEMENTS: ReadonlyArray<readonly [RegExp, string]> =
  [
    [/\bReservation\b/g, 'Réservation'],
    [/\bréservation\b/g, 'réservation'],
    [/\bMateriel\b/g, 'Matériel'],
    [/\bmateriel\b/g, 'matériel'],
    [/\bMedicaments\b/g, 'Médicaments'],
    [/\bmedicaments\b/g, 'médicaments'],
    [/\bconfirme\b/g, 'confirmé'],
    [/\bconfirmee\b/g, 'confirmée'],
    [/\bconfirmees\b/g, 'confirmées'],
    [/\brecue\b/g, 'reçue'],
    [/\brecu\b/g, 'reçu'],
    [/\baffecte\b/g, 'affecté'],
    [/\baffectee\b/g, 'affectée'],
    [/\bvalide\b/g, 'validé'],
    [/\bvalidee\b/g, 'validée'],
    [/\brefuse\b/g, 'refusé'],
    [/\brefusee\b/g, 'refusée'],
    [/\bfinalise\b/g, 'finalisé'],
    [/\bfinalisee\b/g, 'finalisée'],
    [/\bterminee\b/g, 'terminée'],
    [/\bannulee\b/g, 'annulée'],
    [/\btraite\b/g, 'traité'],
    [/\brejete\b/g, 'rejeté'],
    [/\bsecurise\b/g, 'sécurisé'],
    [/\bverifie\b/g, 'vérifié'],
    [/\bverifier\b/g, 'vérifier'],
    [/\brecuperer\b/g, 'récupérer'],
    [/\brecuperera\b/g, 'récupérera'],
    [/\benvoye\b/g, 'envoyé'],
    [/\bajoute\b/g, 'ajouté'],
    [/\bapres\b/g, 'après'],
    [/\bprevue\b/g, 'prévue'],
    [/\bdeja\b/g, 'déjà'],
    [/\ba ete\b/g, 'a été'],
    [/\ba accepte\b/g, 'a accepté'],
    [/\ba annule\b/g, 'a annulé'],
    [/\ba valide\b/g, 'a validé'],
    [/\ba refuse\b/g, 'a refusé'],
    [/\ba ajoute\b/g, 'a ajouté'],
    [/\ba corriger\b/g, 'à corriger'],
    [/\ba votre\b/g, 'à votre'],
    [/\ba vos\b/g, 'à vos'],
    [/\ba la\b/g, 'à la'],
    [/\ba l\u2019/g, 'à l’'],
    [/\ba l'/g, "à l'"],
  ];

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
    private readonly realtimeEvents: EventEmitter2,
  ) {}

  listDeliveryOffers(userId: string) {
    return this.notificationsRepository.listDeliveryOffers(userId);
  }

  async declineDeliveryOffer(userId: string, notificationId: string) {
    if (
      !(await this.notificationsRepository.declineDeliveryOffer(
        userId,
        notificationId,
      ))
    ) {
      throw appHttpException('NOTIFICATIONS_NOT_FOUND');
    }
    this.realtimeEvents.emit('delivery-offer.resolved', {
      userId,
      notificationId,
    });
  }

  async resolveDeliveryOffers(
    orderKey: 'pharmacyOrderId' | 'materialOrderId',
    orderId: string,
  ) {
    const recipients = await this.notificationsRepository.resolveDeliveryOffers(
      orderKey,
      orderId,
    );
    for (const userId of recipients) {
      this.realtimeEvents.emit('delivery-offer.resolved', { userId, orderId });
    }
  }

  async createInAppNotification(input: CreateNotificationInput) {
    const notification = await this.notificationsRepository.create(
      await this.normalizeNotificationInput(input),
    );
    this.realtimeEvents.emit('notification.created', { notification });
    await this.deliveryService.sendPushForNotification(notification);
    return notification;
  }

  async createManyInAppNotifications(
    inputs: CreateNotificationInput[],
  ): Promise<void> {
    if (inputs.length === 0) {
      return;
    }

    const serviceContextByReservation = new Map<
      string,
      ReturnType<
        NotificationsRepositoryPort['resolveReservationNotificationServiceContext']
      >
    >();
    const notifications = await this.notificationsRepository.createMany(
      await Promise.all(
        inputs.map((input) =>
          this.normalizeNotificationInput(input, serviceContextByReservation),
        ),
      ),
    );
    for (const notification of notifications) {
      this.realtimeEvents.emit('notification.created', { notification });
    }
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

  async broadcastByAdmin(params: {
    role: RoleUtilisateur;
    target: 'CLIENT' | 'PRESTATAIRE' | 'ALL';
    title: string;
    body: string;
    data?: Record<string, unknown>;
  }) {
    if (params.role !== RoleUtilisateur.ADMIN) {
      throw appHttpException('USERS_ADMIN_FORBIDDEN_ROLE');
    }

    const recipients =
      await this.recipientRepository.listRecipientsForBroadcast(params.target);

    await this.createManyInAppNotifications(
      recipients.map((recipient) => ({
        userId: recipient.id,
        type: 'ANNONCE_ADMIN',
        title: params.title,
        body: params.body,
        data: params.data,
      })),
    );

    return {
      recipientCount: recipients.length,
      target: params.target,
    };
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

  private async normalizeNotificationInput(
    input: CreateNotificationInput,
    serviceContextByReservation?: Map<
      string,
      ReturnType<
        NotificationsRepositoryPort['resolveReservationNotificationServiceContext']
      >
    >,
  ): Promise<CreateNotificationInput> {
    const reservationId = this.metadataString(input.data, 'reservationId');
    let title = input.title;
    let body = input.body;
    let data = input.data;

    if (reservationId) {
      let serviceContextPromise =
        serviceContextByReservation?.get(reservationId);
      if (!serviceContextPromise) {
        serviceContextPromise =
          this.notificationsRepository.resolveReservationNotificationServiceContext(
            reservationId,
          );
        serviceContextByReservation?.set(reservationId, serviceContextPromise);
      }
      const serviceContext = await serviceContextPromise;
      if (serviceContext) {
        title = this.replaceServiceName(title, serviceContext);
        body = this.replaceServiceName(body, serviceContext);
        data = {
          ...input.data,
          serviceName: serviceContext.displayServiceName,
        };
      }
    }

    return {
      ...input,
      title: this.normalizeNotificationText(title, true),
      body: this.normalizeNotificationText(body, false),
      data,
    };
  }

  private replaceServiceName(
    text: string,
    context: { sourceServiceName: string; displayServiceName: string },
  ): string {
    if (!context.sourceServiceName.trim()) {
      return text;
    }
    const escapedName = context.sourceServiceName.replace(
      /[.*+?^${}()|[\]\\]/g,
      '\\$&',
    );
    return text.replace(
      new RegExp(escapedName, 'gi'),
      context.displayServiceName,
    );
  }

  private metadataString(
    data: CreateNotificationInput['data'],
    key: string,
  ): string | null {
    const value = data?.[key];
    return typeof value === 'string' && value.trim() ? value.trim() : null;
  }

  private normalizeNotificationText(text: string, isTitle: boolean): string {
    const normalized = NOTIFICATION_TEXT_REPLACEMENTS.reduce(
      (value, [expression, replacement]) =>
        value.replace(expression, replacement),
      text.trim().replace(/\s+/g, ' '),
    );
    return isTitle ? normalized.replace(/[.!]+$/, '') : normalized;
  }
}
