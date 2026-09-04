import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiResponse } from '../http/api-response.models';
import { unwrapApiResponse } from '../http/api-response.utils';

export interface UserNotificationView {
  id: string;
  type: string;
  title?: string;
  titre?: string;
  body?: string;
  corps?: string;
  data?: Record<string, unknown> | null;
  donnees?: Record<string, unknown> | null;
  isRead?: boolean;
  estLue?: boolean;
  createdAt?: string;
  creeLe?: string;
}

export interface MarkAllNotificationsReadView {
  updatedCount: number;
}

function notificationMetadataString(
  notification: UserNotificationView,
  key: string,
): string | null {
  const metadata = notification.data || notification.donnees || {};
  const value = metadata[key];
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function notificationTimestamp(notification: UserNotificationView): number {
  const value = notification.createdAt || notification.creeLe;
  const timestamp = value ? Date.parse(value) : 0;
  return Number.isFinite(timestamp) ? timestamp : 0;
}

export function notificationActorName(notification: UserNotificationView): string | null {
  const metadata = notification.data || notification.donnees || {};
  const actorName = [
    metadata['actorName'],
    metadata['senderName'],
    metadata['clientName'],
    metadata['professionalName'],
    metadata['providerName'],
  ].find((value) => typeof value === 'string' && value.trim());
  return typeof actorName === 'string' ? actorName.trim() : null;
}

export function formatNotificationTitle(
  notification: UserNotificationView,
  fallbackTitle = 'Notification',
): string {
  const title = (notification.title || notification.titre || fallbackTitle)
    .trim()
    .replace(/[.!]+$/, '');
  const metadata = notification.data || notification.donnees || {};
  const actorName = notificationActorName(notification) || 'Jokko';
  const serviceName =
    typeof metadata['serviceName'] === 'string' ? metadata['serviceName'].trim() : '';
  const serviceContext = serviceName ? ` pour « ${serviceName} »` : '';
  const normalizedTitle = title
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase();

  if (normalizedTitle.includes('nouvelle reservation') && normalizedTitle.includes('confirm')) {
    return `${actorName} - Nouvelle réservation confirmée${serviceContext}`;
  }
  if (normalizedTitle.includes('prestation terminee')) {
    return `${actorName} - Prestation terminée${serviceContext}`;
  }
  if (normalizedTitle.includes('vous etes en route')) {
    return `${actorName} - Trajet démarré${serviceContext}`;
  }
  if (normalizedTitle.includes('le client est en route')) {
    return `${actorName} - En route vers le rendez-vous${serviceContext}`;
  }
  if (normalizedTitle.includes('prestataire en route')) {
    return `${actorName} - En route vers votre rendez-vous${serviceContext}`;
  }
  if (normalizedTitle.includes('reservation annulee')) {
    return `${actorName} - Réservation annulée${serviceContext}`;
  }

  const actorAtStart = new RegExp(
    `^${actorName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*(?:[:\\-â€“â€”]\\s*)?`,
    'i',
  );
  const titleWithoutRepeatedActor = title.replace(actorAtStart, '').trim();
  const motif = titleWithoutRepeatedActor || title;
  return `${actorName} - ${motif.charAt(0).toLocaleUpperCase()}${motif.slice(1)}`;
}

export function findFeaturedNotification(
  notifications: UserNotificationView[],
): UserNotificationView | null {
  const activeOnTheWay = notifications.find((notification) => {
    const metadata = notification.data || notification.donnees || {};
    if (
      notification.type !== 'PRESTATAIRE_EN_ROUTE' &&
      metadata['persistentUntilTerminal'] !== true
    ) {
      return false;
    }
    const reservationId = notificationMetadataString(notification, 'reservationId');
    if (!reservationId) return false;
    const startedAt = notificationTimestamp(notification);
    return !notifications.some((candidate) => {
      const terminal =
        candidate.type === 'RESERVATION_FINALISEE' || candidate.type === 'RESERVATION_ANNULEE';
      return (
        terminal &&
        notificationMetadataString(candidate, 'reservationId') === reservationId &&
        notificationTimestamp(candidate) >= startedAt
      );
    });
  });
  if (activeOnTheWay) return activeOnTheWay;

  const activeDeliveryOffer = notifications.find((notification) => {
    const metadata = notification.data || notification.donnees || {};
    if (metadata['persistentDeliveryOffer'] !== true) return false;
    const pharmacyOrderId = notificationMetadataString(notification, 'pharmacyOrderId');
    if (!pharmacyOrderId) return false;
    const createdAt = notificationTimestamp(notification);
    return !notifications.some((candidate) => {
      const candidateMetadata = candidate.data || candidate.donnees || {};
      return (
        candidateMetadata['deliveryOfferResolved'] === true &&
        notificationMetadataString(candidate, 'pharmacyOrderId') === pharmacyOrderId &&
        notificationTimestamp(candidate) >= createdAt
      );
    });
  });
  if (activeDeliveryOffer) return activeDeliveryOffer;

  return (
    notifications.find((notification) => {
      const metadata = notification.data || notification.donnees || {};
      const isResolvedDeliveryOffer =
        metadata['persistentDeliveryOffer'] === true &&
        notifications.some((candidate) => {
          const candidateMetadata = candidate.data || candidate.donnees || {};
          return (
            candidateMetadata['deliveryOfferResolved'] === true &&
            notificationMetadataString(candidate, 'pharmacyOrderId') ===
              notificationMetadataString(notification, 'pharmacyOrderId')
          );
        });
      return !isResolvedDeliveryOffer && !(notification.isRead ?? notification.estLue);
    }) ?? null
  );
}

@Injectable({
  providedIn: 'root',
})
export class NotificationsService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = `${environment.apiUrl}/notifications`;

  list(
    options: { read?: boolean; limit?: number; offset?: number } = {},
  ): Observable<UserNotificationView[]> {
    const params: Record<string, string> = {};
    if (typeof options.read === 'boolean') params['read'] = String(options.read);
    if (typeof options.limit === 'number') params['limit'] = String(options.limit);
    if (typeof options.offset === 'number') params['offset'] = String(options.offset);

    return this.http
      .get<ApiResponse<UserNotificationView[]>>(this.apiUrl, { params })
      .pipe(map(unwrapApiResponse));
  }

  markAllAsRead(): Observable<MarkAllNotificationsReadView> {
    return this.http
      .patch<ApiResponse<MarkAllNotificationsReadView>>(`${this.apiUrl}/read-all`, {})
      .pipe(map(unwrapApiResponse));
  }

  markAsRead(notificationId: string): Observable<UserNotificationView> {
    return this.http
      .patch<ApiResponse<UserNotificationView>>(`${this.apiUrl}/${notificationId}/read`, {})
      .pipe(map(unwrapApiResponse));
  }

  registerDeviceToken(fcmToken: string): Observable<void> {
    return this.http
      .post<ApiResponse<null>>(`${this.apiUrl}/device-token`, { fcmToken })
      .pipe(map(() => undefined));
  }
}
