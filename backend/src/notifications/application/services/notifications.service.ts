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

  async createInAppNotification(input: CreateNotificationInput) {
    const notification = await this.notificationsRepository.create(
      this.normalizeNotificationInput(input),
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

    const notifications = await this.notificationsRepository.createMany(
      inputs.map((input) => this.normalizeNotificationInput(input)),
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

  private normalizeNotificationInput(
    input: CreateNotificationInput,
  ): CreateNotificationInput {
    return {
      ...input,
      title: this.normalizeNotificationText(input.title, true),
      body: this.normalizeNotificationText(input.body, false),
    };
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
