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
