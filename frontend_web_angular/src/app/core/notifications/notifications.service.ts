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
  /** Client-side deadline used to preserve a transient widget across reloads. */
  displayExpiresAt?: number;
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
    return (
      (notification.body || notification.corps || '')
        .match(/^(.+?) (?:a tent[ée] de vous joindre|vous appelle)[.!]?$/i)?.[1]
        ?.trim() || null
    );
  }
  return null;
}

export function formatNotificationTitle(
  notification: UserNotificationView,
  fallbackTitle = 'Notification',
): string {
  const title = (notification.title || notification.titre || fallbackTitle)
    .trim()
    .replace(/[.!]+$/, '');
  const actor = notificationActorName(notification);
  const type = notification.type.toUpperCase();
  const metadata = notification.data || notification.donnees || {};
  const from = actor ? ` de ${actor}` : '';
  const withPerson = actor ? ` avec ${actor}` : '';
  const by = actor ? ` par ${actor}` : '';
  const isDeliveryJourney =
    metadata['deliveryStage'] === 'PICKUP' || metadata['deliveryStage'] === 'DROPOFF';
  // Delivery notifications already contain the exact wording for the current
  // pickup/drop-off phase. Keep it untouched on the first line; the service
  // name remains exclusively on the subtitle line.
  if (isDeliveryJourney) return title;
  if (type === 'APPEL_MANQUE') return `Appel manqué${from}`;
  if (type === 'APPEL_ENTRANT') return `Appel entrant${from}`;
  if (type.includes('MESSAGE')) return `Nouveau message${from}`;
  if (isOngoingNotification(notification)) return `La prestation est en cours${withPerson}`;
  if (metadata['tripStatus'] === 'SUR_PLACE')
    return actor ? `${actor} est sur place` : 'Arrivé sur place';
  if (type === 'PRESTATAIRE_EN_ROUTE') {
    if (metadata['recipientIsTraveller'] === true && metadata['tripStatus'] === 'EN_ROUTE') {
      const targetName =
        typeof metadata['targetName'] === 'string' && metadata['targetName'].trim()
          ? metadata['targetName'].trim()
          : 'votre destination';
      return `Vous êtes en route vers ${targetName}`;
    }
    if (metadata['deliveryOfferResolved'] === true) return 'Livraison acceptée';
    return actor ? `${actor} est en route` : 'Livreur en route';
  }
  const amount = metadata['amount'];
  if (typeof amount === 'number' && Number.isFinite(amount)) {
    const formattedAmount = amount.toLocaleString('fr-FR');
    if (metadata['walletCredit'] === true) {
      return `Votre wallet est crédité de + ${formattedAmount} FCFA`;
    }
    if (metadata['walletDebit'] === true) {
      return `Votre wallet est débité de - ${formattedAmount} FCFA`;
    }
  }
  const notificationLabels: Record<string, string> = {
    NOUVELLE_RESERVATION: actor ? `Nouvelle réservation de ${actor}` : 'Nouvelle réservation',
    RESERVATION_CONFIRMEE: `Réservation confirmée${withPerson}`,
    RESERVATION_ANNULEE: `Réservation annulée${withPerson}`,
    RESERVATION_FINALISEE: `Prestation terminée${withPerson}`,
    AJUSTEMENT_PRIX_PROPOSE: `Ajustement de prix proposé${by}`,
    AJUSTEMENT_PRIX_ACCEPTE: `Ajustement de prix accepté${by}`,
    AJUSTEMENT_PRIX_REFUSE: `Ajustement de prix refusé${by}`,
    PAIEMENT_CONFIRME: `Paiement confirmé${by}`,
    PAIEMENT_LIBERE: `Paiement libéré${by}`,
    RETRAIT_EFFECTUE: 'Retrait effectué',
    KYC_APPROUVEE: 'Vérification approuvée',
    KYC_REJETEE: 'Vérification à compléter',
    LITIGE_OUVERT: `Litige ouvert${withPerson}`,
    LITIGE_RESOLU: `Litige résolu${withPerson}`,
  };
  if (notificationLabels[type]) return notificationLabels[type];
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
  const serviceName = notificationMetadataString(notification, 'serviceName');
  const titleWithoutServiceName = serviceName
    ? title
        .replaceAll(serviceName, '')
        .replace(/\s+(?:pour|de|du|des|d')\s*$/i, '')
        .trim()
    : title;
  const wording = titleWithoutServiceName.replace(/\s+[—–-]\s+/g, ' concernant ');
  return actor && !wording.toLocaleLowerCase().includes(actor.toLocaleLowerCase())
    ? `${wording}${withPerson}`
    : wording;
}

export function notificationAvatarUrl(notification: UserNotificationView): string | null {
  const metadata = notification.data || notification.donnees || {};
  for (const key of [
    'avatarUrl',
    'senderAvatarUrl',
    'callerAvatarUrl',
    'clientAvatarUrl',
    'professionalAvatarUrl',
    'providerAvatarUrl',
  ]) {
    const value = metadata[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return null;
}

export function notificationSubtitle(notification: UserNotificationView): string {
  const serviceName = notificationMetadataString(notification, 'serviceName');
  if (serviceName) return serviceName;

  const metadata = notification.data || notification.donnees || {};
  if (isWalletNotification(notification)) return 'Voir le wallet';
  if (metadata['walletDebit'] === true) return '';
  if (typeof metadata['pharmacyOrderId'] === 'string') return 'Livraison de médicaments';
  if (typeof metadata['materialOrderId'] === 'string') return 'Livraison de matériel';

  const type = notification.type.toUpperCase();
  if (/APPEL/.test(type)) return 'Consultez vos appels';
  if (/MESSAGE/.test(type)) return 'Ouvrez la conversation';
  if (/ANNONCE/.test(type)) return 'Voir l’annonce';
  if (/AJUSTEMENT/.test(type)) return 'Voir la proposition';
  if (/PAIEMENT|PAYMENT|WALLET|PORTEFEUILLE/.test(type)) return 'Voir le paiement';
  if (/ORDONNANCE/.test(type)) return 'Voir l’ordonnance';
  if (/LITIGE/.test(type)) return 'Voir le dossier';
  if (/KYC|PROFIL/.test(type)) return 'Voir votre profil';
  if (/RESERVATION|PRESTATAIRE_EN_ROUTE|PRESTATION_EN_COURS/.test(type)) {
    return 'Voir la réservation';
  }
  return 'Voir la notification';
}

/** Color semantic for wallet movements shown in notification lists and the navbar. */
export function notificationWalletAmountTone(
  notification: UserNotificationView,
): 'credit' | 'debit' | null {
  const metadata = notification.data || notification.donnees || {};
  if (metadata['walletCredit'] === true) return 'credit';
  if (metadata['walletDebit'] === true) return 'debit';
  return null;
}

export function notificationWalletAmount(notification: UserNotificationView): string | null {
  const metadata = notification.data || notification.donnees || {};
  const amount = metadata['amount'];
  const tone = notificationWalletAmountTone(notification);
  if (typeof amount !== 'number' || !Number.isFinite(amount) || !tone) return null;
  return `${tone === 'credit' ? '+' : '-'} ${amount.toLocaleString('fr-FR')} FCFA`;
}

export function notificationWalletTitlePrefix(notification: UserNotificationView): string | null {
  const tone = notificationWalletAmountTone(notification);
  if (tone === 'credit') return 'Votre wallet est crédité de';
  if (tone === 'debit') return 'Votre wallet est débité de';
  return null;
}

export function isWalletNotification(notification: UserNotificationView): boolean {
  const metadata = notification.data || notification.donnees || {};
  if (metadata['walletCredit'] === true || metadata['walletDebit'] === true) return true;
  return /WALLET|PORTEFEUILLE|PAIEMENT_LIBERE|RETRAIT/.test(notification.type.toUpperCase());
}

export function sortNotificationsNewestFirst(
  notifications: UserNotificationView[],
): UserNotificationView[] {
  return [...notifications].sort((a, b) => notificationTimestamp(b) - notificationTimestamp(a));
}

export function isOngoingNotification(notification: UserNotificationView): boolean {
  const metadata = notification.data || notification.donnees || {};
  const reservationStatus = String(metadata['reservationStatus'] ?? '').toUpperCase();
  const tripStatus = String(metadata['tripStatus'] ?? '').toUpperCase();
  const notificationText = [notification.title, notification.body, notification.corps]
    .filter((value): value is string => typeof value === 'string')
    .join(' ')
    .toLocaleLowerCase('fr-FR');

  return (
    reservationStatus === 'EN_COURS' ||
    tripStatus === 'EN_COURS' ||
    notification.type === 'PRESTATION_EN_COURS' ||
    /\bprestation\b.*\ben cours\b/.test(notificationText)
  );
}

/** Arrival and active work remain visible until the reservation is resolved. */
export function isPersistentServiceNotification(notification: UserNotificationView): boolean {
  const metadata = notification.data || notification.donnees || {};
  const reservationStatus = String(metadata['reservationStatus'] ?? '').toUpperCase();
  const tripStatus = String(metadata['tripStatus'] ?? '').toUpperCase();
  if (
    ['TERMINEE', 'ANNULEE'].includes(reservationStatus) ||
    ['TERMINEE', 'ANNULEE'].includes(tripStatus)
  ) {
    return false;
  }
  return (
    isOngoingNotification(notification) ||
    tripStatus === 'SUR_PLACE' ||
    (metadata['persistentUntilTerminal'] === true &&
      typeof metadata['reservationId'] === 'string' &&
      metadata['reservationId'].trim().length > 0)
  );
}

export function findFeaturedNotification(
  notifications: UserNotificationView[],
  dismissed: (id: string) => boolean = () => false,
): UserNotificationView | null {
  const sorted = sortNotificationsNewestFirst(notifications).filter((notification) => {
    const data = notification.data || notification.donnees || {};
    return (
      data['persistentDeliveryOffer'] !== true &&
      !(typeof data['route'] === 'string' && data['route'].endsWith('/delivery-offer'))
    );
  });
  const latest = sorted[0];
  if (
    latest &&
    !isPersistentServiceNotification(latest) &&
    !dismissed(latest.id) &&
    !(latest.isRead ?? latest.estLue)
  )
    return latest;
  return (
    sorted.find((notification) => {
      if (!isPersistentServiceNotification(notification)) return false;
      const reservationId = notificationMetadataString(notification, 'reservationId');
      return (
        !!reservationId &&
        !sorted.some(
          (candidate) =>
            ['RESERVATION_FINALISEE', 'RESERVATION_ANNULEE'].includes(candidate.type) &&
            notificationMetadataString(candidate, 'reservationId') === reservationId &&
            notificationTimestamp(candidate) >= notificationTimestamp(notification),
        )
      );
    }) ?? null
  );
}

export function notificationIcon(notification: UserNotificationView): string {
  const metadata = {
    ...(notification.donnees ?? {}),
    ...(notification.data ?? {}),
  };
  const type = notification.type.toUpperCase();
  const title = (notification.title || notification.titre || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase();
  if (/APPEL.*MANQUE/.test(type)) return 'phone-missed';
  if (/APPEL/.test(type)) return 'phone-incoming';
  if (isOngoingNotification(notification)) return 'hourglass';
  if (metadata['tripStatus'] === 'SUR_PLACE') return 'pin';
  if (/AJUSTEMENT/.test(type)) {
    if (/REFUS|REJET/.test(type + title)) return 'circle-x';
    if (/ACCEPT/.test(type + title)) return 'circle-check';
    const direction = priceAdjustmentDirection(
      metadata,
      notification.body || notification.corps || '',
    );
    if (direction === 'DOWN') return 'move-down';
    if (direction === 'UP') return 'move-up';
    return 'banknote';
  }
  if (/MESSAGE/.test(type)) return 'message-circle';
  if (/WALLET|PORTEFEUILLE|PAIEMENT_LIBERE|RETRAIT/.test(type)) return 'wallet-cards';
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

function priceAdjustmentDirection(
  metadata: Record<string, unknown>,
  body: string,
): 'UP' | 'DOWN' | null {
  const explicit = String(
    metadata['priceDirection'] ?? metadata['adjustmentDirection'] ?? '',
  ).toUpperCase();
  if (['UP', 'INCREASE', 'AUGMENTATION', 'HAUSSE'].includes(explicit)) return 'UP';
  if (['DOWN', 'DECREASE', 'DIMINUTION', 'BAISSE'].includes(explicit)) return 'DOWN';

  const current = notificationAmount(
    metadata['currentPrice'] ??
      metadata['currentAmount'] ??
      metadata['oldPrice'] ??
      metadata['oldAmount'] ??
      metadata['previousPrice'] ??
      metadata['previousAmount'] ??
      metadata['initialPrice'] ??
      metadata['initialAmount'] ??
      metadata['referencePrice'] ??
      metadata['referenceAmount'] ??
      metadata['basePrice'] ??
      metadata['baseAmount'] ??
      metadata['prixActuel'] ??
      metadata['montantActuel'] ??
      metadata['montantCourant'] ??
      metadata['prixConvenu'] ??
      metadata['prixInitial'],
  );
  const proposed = notificationAmount(
    metadata['proposedPrice'] ??
      metadata['proposedAmount'] ??
      metadata['newPrice'] ??
      metadata['newAmount'] ??
      metadata['nouveauPrix'] ??
      metadata['nouveauMontant'] ??
      metadata['montantPropose'] ??
      metadata['prixAjustementPropose'],
  );
  if (Number.isFinite(current) && Number.isFinite(proposed) && current !== proposed) {
    return proposed > current ? 'UP' : 'DOWN';
  }

  const normalizedBody = body
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
  const legacyCurrent = notificationAmount(
    normalizedBody.match(/(?:ancien|precedent)\s*(?:prix|montant)\s*:\s*([\d\s.,]+)/i)?.[1],
  );
  const legacyProposed = notificationAmount(
    normalizedBody.match(/(?:nouveau\s*)?(?:prix|montant)\s*(?:propose)?\s*:\s*([\d\s.,]+)/i)?.[1],
  );
  if (
    Number.isFinite(legacyCurrent) &&
    Number.isFinite(legacyProposed) &&
    legacyCurrent !== legacyProposed
  ) {
    return legacyProposed > legacyCurrent ? 'UP' : 'DOWN';
  }
  if (/augmentation|hausse|augmente/.test(normalizedBody)) return 'UP';
  if (/diminution|baisse|diminue/.test(normalizedBody)) return 'DOWN';
  return null;
}

function notificationAmount(value: unknown): number {
  if (typeof value === 'number') return value;
  if (typeof value !== 'string') return Number.NaN;
  const normalized = value
    .replace(/\s/g, '')
    .replace(',', '.')
    .replace(/[^\d.-]/g, '');
  return normalized ? Number(normalized) : Number.NaN;
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
