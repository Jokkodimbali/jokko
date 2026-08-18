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

export function findFeaturedNotification(
  notifications: UserNotificationView[],
): UserNotificationView | null {
  const activeOnTheWay = notifications.find((notification) => {
    if (notification.type !== 'PRESTATAIRE_EN_ROUTE') return false;
    const reservationId = notificationMetadataString(notification, 'reservationId');
    if (!reservationId) return false;
    const startedAt = notificationTimestamp(notification);
    return !notifications.some((candidate) => {
      const terminal =
        candidate.type === 'RESERVATION_FINALISEE' ||
        candidate.type === 'RESERVATION_ANNULEE';
      return (
        terminal &&
        notificationMetadataString(candidate, 'reservationId') === reservationId &&
        notificationTimestamp(candidate) >= startedAt
      );
    });
  });
  if (activeOnTheWay) return activeOnTheWay;
  return (
    notifications.find((notification) => !(notification.isRead ?? notification.estLue)) ?? null
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
