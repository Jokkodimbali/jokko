import { Injectable } from '@nestjs/common';
import { Prisma, TypeNotification } from '@prisma/client';
import { PrismaService } from '../../../prisma/prisma.service';
import {
  type NotificationMetadata,
  type NotificationType,
  type NotificationView,
} from '../../domain/entities/notification.entity';
import {
  type CreateNotificationInput,
  type ListUserNotificationsQuery,
  type NotificationsRepositoryPort,
} from '../../application/ports/notifications-repository.port';

const PRISMA_NOTIFICATION_TYPE_BY_DOMAIN: Record<
  NotificationType,
  TypeNotification
> = {
  NOUVELLE_RESERVATION: TypeNotification.NOUVELLE_RESERVATION,
  RESERVATION_CONFIRMEE: TypeNotification.RESERVATION_CONFIRMEE,
  RESERVATION_ANNULEE: TypeNotification.RESERVATION_ANNULEE,
  PAIEMENT_CONFIRME: TypeNotification.PAIEMENT_CONFIRME,
  AJUSTEMENT_PRIX_PROPOSE: TypeNotification.AJUSTEMENT_PRIX_PROPOSE,
  AJUSTEMENT_PRIX_ACCEPTE: TypeNotification.AJUSTEMENT_PRIX_ACCEPTE,
  AJUSTEMENT_PRIX_REFUSE: TypeNotification.AJUSTEMENT_PRIX_REFUSE,
  PRESTATAIRE_EN_ROUTE: TypeNotification.PRESTATAIRE_EN_ROUTE,
  PAIEMENT_LIBERE: TypeNotification.PAIEMENT_LIBERE,
  NOUVEAU_MESSAGE: TypeNotification.NOUVEAU_MESSAGE,
  KYC_APPROUVEE: TypeNotification.KYC_APPROUVEE,
  KYC_REJETEE: TypeNotification.KYC_REJETEE,
  LITIGE_OUVERT: TypeNotification.LITIGE_OUVERT,
  LITIGE_RESOLU: TypeNotification.LITIGE_RESOLU,
  RESERVATION_FINALISEE: TypeNotification.RESERVATION_FINALISEE,
  ANNONCE_ADMIN: TypeNotification.ANNONCE_ADMIN,
  APPEL_ENTRANT: TypeNotification.APPEL_ENTRANT,
  APPEL_MANQUE: TypeNotification.APPEL_MANQUE,
};

type PrismaNotification = {
  id: string;
  utilisateurId: string;
  type: TypeNotification;
  titre: string;
  corps: string;
  donnees: Prisma.JsonValue | null;
  estLue: boolean;
  creeLe: Date;
};

@Injectable()
export class NotificationsRepository implements NotificationsRepositoryPort {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: CreateNotificationInput): Promise<NotificationView> {
    const notification = await this.prisma.notification.create({
      data: {
        utilisateurId: input.userId,
        type: this.toPrismaType(input.type),
        titre: input.title,
        corps: input.body,
        donnees: this.toPrismaJson(input.data),
      },
    });

    return this.toView(notification);
  }

  async createMany(
    inputs: CreateNotificationInput[],
  ): Promise<NotificationView[]> {
    if (inputs.length === 0) {
      return [];
    }

    const notifications = await this.prisma.notification.createManyAndReturn({
      data: inputs.map((input) => ({
        utilisateurId: input.userId,
        type: this.toPrismaType(input.type),
        titre: input.title,
        corps: input.body,
        donnees: this.toPrismaJson(input.data),
      })),
    });

    return notifications.map((notification) => this.toView(notification));
  }

  async markAllAsReadForUser(userId: string): Promise<number> {
    const result = await this.prisma.notification.updateMany({
      where: {
        utilisateurId: userId,
        estLue: false,
      },
      data: { estLue: true },
    });

    return result.count;
  }

  async listByUser(
    query: ListUserNotificationsQuery,
  ): Promise<NotificationView[]> {
    const notifications = await this.prisma.notification.findMany({
      where: {
        utilisateurId: query.userId,
        estLue: query.isRead,
      },
      orderBy: { creeLe: 'desc' },
      take: query.limit,
      skip: query.offset,
    });

    const reservationIds = Array.from(
      new Set(
        notifications
          .map((notification) => this.metadataString(notification.donnees, 'reservationId'))
          .filter((value): value is string => !!value),
      ),
    );
    const reservations =
      reservationIds.length > 0
        ? await this.prisma.reservation.findMany({
            where: { id: { in: reservationIds } },
            select: {
              id: true,
              clientId: true,
              client: { select: { nom: true, urlAvatar: true } },
              professionnel: {
                select: {
                  utilisateur: { select: { nom: true, urlAvatar: true } },
                },
              },
            },
          })
        : [];
    const reservationById = new Map(reservations.map((reservation) => [reservation.id, reservation]));

    const negotiationIds = Array.from(
      new Set(
        notifications
          .map((notification) => this.metadataString(notification.donnees, 'negotiationId'))
          .filter((value): value is string => !!value),
      ),
    );
    const negotiations =
      negotiationIds.length > 0
        ? await this.prisma.negotiation.findMany({
            where: { id: { in: negotiationIds } },
            select: {
              id: true,
              clientId: true,
              client: { select: { nom: true, urlAvatar: true } },
              professionnel: {
                select: { utilisateur: { select: { nom: true, urlAvatar: true } } },
              },
            },
          })
        : [];
    const negotiationById = new Map(
      negotiations.map((negotiation) => [negotiation.id, negotiation]),
    );

    const senderIds = Array.from(
      new Set(
        notifications
          .map((notification) => this.metadataString(notification.donnees, 'senderId'))
          .filter((value): value is string => !!value),
      ),
    );
    const senders =
      senderIds.length > 0
        ? await this.prisma.utilisateur.findMany({
            where: { id: { in: senderIds } },
            select: { id: true, nom: true, urlAvatar: true },
          })
        : [];
    const senderById = new Map(senders.map((sender) => [sender.id, sender]));

    return notifications.map((notification) => {
      const reservationId = this.metadataString(notification.donnees, 'reservationId');
      const reservation = reservationId ? reservationById.get(reservationId) : undefined;
      const negotiationId = this.metadataString(notification.donnees, 'negotiationId');
      const negotiation = negotiationId ? negotiationById.get(negotiationId) : undefined;
      const senderId = this.metadataString(notification.donnees, 'senderId');
      const sender = senderId ? senderById.get(senderId) : undefined;
      const actor = reservation
        ? notification.utilisateurId === reservation.clientId
          ? reservation.professionnel.utilisateur
          : reservation.client
        : negotiation
          ? notification.utilisateurId === negotiation.clientId
            ? negotiation.professionnel.utilisateur
            : negotiation.client
          : sender;
      if (!actor) return this.toView(notification);

      const metadata = this.toMetadata(notification.donnees) ?? {};
      return this.toView(notification, {
        ...metadata,
        actorName: actor.nom,
        avatarUrl: actor.urlAvatar,
      });
    });
  }

  async markAsReadForUser(
    notificationId: string,
    userId: string,
  ): Promise<NotificationView | null> {
    const notification = await this.prisma.notification.findFirst({
      where: {
        id: notificationId,
        utilisateurId: userId,
      },
    });

    if (!notification) {
      return null;
    }

    const updated = await this.prisma.notification.update({
      where: { id: notificationId },
      data: { estLue: true },
    });

    return this.toView(updated);
  }

  private toPrismaType(type: NotificationType): TypeNotification {
    return PRISMA_NOTIFICATION_TYPE_BY_DOMAIN[type];
  }

  private toPrismaJson(
    data?: NotificationMetadata,
  ): Prisma.InputJsonValue | undefined {
    if (!data) {
      return undefined;
    }

    return data as Prisma.InputJsonObject;
  }

  private toView(
    notification: PrismaNotification,
    data: NotificationMetadata | null = this.toMetadata(notification.donnees),
  ): NotificationView {
    return {
      id: notification.id,
      userId: notification.utilisateurId,
      type: notification.type,
      title: notification.titre,
      body: notification.corps,
      data,
      isRead: notification.estLue,
      createdAt: notification.creeLe,
    };
  }

  private toMetadata(
    data: Prisma.JsonValue | null,
  ): NotificationMetadata | null {
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      return null;
    }

    return data as NotificationMetadata;
  }

  private metadataString(data: Prisma.JsonValue | null, key: string): string | null {
    const metadata = this.toMetadata(data);
    const value = metadata?.[key];
    return typeof value === 'string' && value.trim() ? value.trim() : null;
  }
}
