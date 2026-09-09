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
    metadata['callerName'],
    metadata['clientName'],
    metadata['professionalName'],
    metadata['providerName'],
  ].find((value) => typeof value === 'string' && value.trim());
  if (typeof actorName === 'string') return actorName.trim();
  // Older call notifications stored the caller only in their message.
  if (/APPEL/i.test(notification.type)) {
    return (notification.body || notification.corps || '').match(
      /^(.+?) (?:a tent[ée] de vous joindre|vous appelle)[.!]?$/i,
    )?.[1]?.trim() || null;
  }
  return null;
}

export function formatNotificationTitle(
  notification: UserNotificationView,
  fallbackTitle = 'Notification',
): string {
  const title = (notification.title || notification.titre || fallbackTitle).trim().replace(/[.!]+$/, '');
  const actor = notificationActorName(notification);
  const type = notification.type.toUpperCase();
  const metadata = notification.data || notification.donnees || {};
  const from = actor ? ` de ${actor}` : '';
  const withPerson = actor ? ` avec ${actor}` : '';
  const by = actor ? ` par ${actor}` : '';
  if (type === 'APPEL_MANQUE') return `Appel manqué${from}`;
  if (type === 'APPEL_ENTRANT') return `Appel entrant${from}`;
  if (type.includes('MESSAGE')) return `Nouveau message${from}`;
  if (isOngoingNotification(notification)) return `La prestation est en cours${withPerson}`;
  if (metadata['tripStatus'] === 'SUR_PLACE') return actor ? `${actor} est sur place` : 'Arrivé sur place';
  const labels: Record<string, string> = {
    NOUVELLE_RESERVATION: 'Réservation confirmée',
    RESERVATION_CONFIRMEE: 'Réservation confirmée',
    RESERVATION_ANNULEE: 'Réservation annulée',
    RESERVATION_FINALISEE: 'La prestation est terminée',
  };
  if (labels[type]) return `${labels[type]}${withPerson}`;
  const events: Record<string, string> = {
    AJUSTEMENT_PRIX_PROPOSE: 'Ajustement de prix proposé',
    AJUSTEMENT_PRIX_ACCEPTE: 'Ajustement de prix accepté',
    AJUSTEMENT_PRIX_REFUSE: 'Ajustement de prix refusé',
    PAIEMENT_CONFIRME: 'Paiement confirmé',
    LITIGE_OUVERT: 'Litige ouvert',
    LITIGE_RESOLU: 'Litige résolu',
  };
  if (events[type]) return `${events[type]}${type.startsWith('LITIGE') ? withPerson : by}`;
  if (type === 'ORDONNANCE_RECUE') return `Ordonnance reçue${from}`;
  if (type === 'ORDONNANCE_MISE_A_JOUR') return `Ordonnance mise à jour${by}`;
  // Older notifications put the person's name before a dash.
  if (actor) {
    for (const separator of [' - ', ' — ', ' – ']) {
      if (title.startsWith(`${actor}${separator}`)) {
        const wording = title.slice(actor.length + separator.length).trim();
        return `${wording}${withPerson}`;
      }
    }
  }
  // Preserve hyphens within names and words; only replace separator dashes.
  const wording = title.replace(/\s+[—–-]\s+/g, ' concernant ');
  return actor && !wording.toLocaleLowerCase().includes(actor.toLocaleLowerCase())
    ? `${wording}${withPerson}` : wording;
}

export function notificationAvatarUrl(notification: UserNotificationView): string | null {
  const metadata = notification.data || notification.donnees || {};
  for (const key of ['avatarUrl', 'senderAvatarUrl', 'callerAvatarUrl', 'clientAvatarUrl', 'professionalAvatarUrl', 'providerAvatarUrl']) {
    const value = metadata[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return null;
}

export function notificationSubtitle(notification: UserNotificationView): string {
  const body = notification.body || notification.corps || '';
  if (/MESSAGE|ANNONCE/i.test(notification.type)) return body;
  return notificationMetadataString(notification, 'serviceName') || body;
}

export function sortNotificationsNewestFirst(notifications: UserNotificationView[]): UserNotificationView[] {
  return [...notifications].sort((a, b) => notificationTimestamp(b) - notificationTimestamp(a));
}

export function isOngoingNotification(notification: UserNotificationView): boolean {
  const metadata = notification.data || notification.donnees || {};
  return metadata['reservationStatus'] === 'EN_COURS' ||
    metadata['tripStatus'] === 'EN_COURS' || notification.type === 'PRESTATION_EN_COURS';
}

/** Arrival and active work remain visible until the reservation is resolved. */
export function isPersistentServiceNotification(notification: UserNotificationView): boolean {
  const metadata = notification.data || notification.donnees || {};
  return isOngoingNotification(notification) || metadata['tripStatus'] === 'SUR_PLACE';
}

export function findFeaturedNotification(
  notifications: UserNotificationView[],
  dismissed: (id: string) => boolean = () => false,
): UserNotificationView | null {
  const sorted = sortNotificationsNewestFirst(notifications).filter(notification => {
    const data = notification.data || notification.donnees || {};
    return data['persistentDeliveryOffer'] !== true &&
      !(typeof data['route'] === 'string' && data['route'].endsWith('/delivery-offer'));
  });
  const latest = sorted[0];
  if (latest && !isPersistentServiceNotification(latest) && !dismissed(latest.id) && !(latest.isRead ?? latest.estLue)) return latest;
  return sorted.find((notification) => {
    if (!isPersistentServiceNotification(notification)) return false;
    const reservationId = notificationMetadataString(notification, 'reservationId');
    return !!reservationId && !sorted.some((candidate) =>
      ['RESERVATION_FINALISEE', 'RESERVATION_ANNULEE'].includes(candidate.type) &&
      notificationMetadataString(candidate, 'reservationId') === reservationId &&
      notificationTimestamp(candidate) >= notificationTimestamp(notification),
    );
  }) ?? null;
}

export function notificationIcon(notification: UserNotificationView): string {
    const metadata = notification.data || notification.donnees || {};
    const type = notification.type.toUpperCase();
    const title = (notification.title || notification.titre || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
    if (/APPEL.*MANQUE/.test(type)) return 'phone-missed';
    if (/APPEL/.test(type)) return 'phone-incoming';
    if (isOngoingNotification(notification)) return 'hourglass';
    if (metadata['tripStatus'] === 'SUR_PLACE') return 'pin';
    if (/AJUSTEMENT/.test(type)) return /REFUS|REJET/.test(type + title) ? 'circle-x' : /ACCEPT/.test(type + title) ? 'circle-check' : 'banknote';
    if (/MESSAGE/.test(type)) return 'message-circle';
    if (/WALLET|PORTEFEUILLE|PAIEMENT_LIBERE/.test(type)) return 'wallet-cards';
    if (/PAYMENT|PAIEMENT/.test(type)) return 'hand-coins';
    if (/LITIGE/.test(type)) return /RESOLU/.test(type + title) ? 'handshake' : 'scale';
    if (/KYC|PROFIL/.test(type)) return /REFUS|REJET/.test(type + title) ? 'frown' : 'party-popper';
    if (/ORDONNANCE/.test(type)) return 'siren';
    if (/ANNONCE/.test(type)) return 'rss';
    if (/EN_ROUTE/.test(type)) return 'route';
    if (/ANNULEE/.test(type)) return 'calendar-x';
    if (/FINALISEE/.test(type)) return 'check';
    if (/RESERVATION/.test(type)) return 'calendar-check';
    return 'bell';
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
      .pipe(map(unwrapApiResponse), map(sortNotificationsNewestFirst));
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
