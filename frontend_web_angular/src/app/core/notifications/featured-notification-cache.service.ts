import { Injectable } from '@angular/core';
import { findFeaturedNotification, UserNotificationView } from './notifications.service';

/** Preserves the active trip notification while a page-level navbar is recreated. */
@Injectable({ providedIn: 'root' })
export class FeaturedNotificationCacheService {
  private readonly dismissedTransientNotificationIds = new Set<string>();

  isTransientDismissed(notificationId: string): boolean {
    return this.dismissedTransientNotificationIds.has(notificationId);
  }

  dismissTransient(notificationId: string): void {
    this.dismissedTransientNotificationIds.add(notificationId);
  }

  read(userId: string | null | undefined): UserNotificationView | null {
    if (!userId) return null;
    try {
      const raw = sessionStorage.getItem(this.storageKey(userId));
      if (!raw) return null;
      const notification = JSON.parse(raw) as UserNotificationView;
      return this.persistentNotification([notification]);
    } catch {
      return null;
    }
  }

  sync(userId: string | null | undefined, notifications: UserNotificationView[]): void {
    if (!userId) return;
    const featured = this.persistentNotification(notifications);
    try {
      if (featured) {
        sessionStorage.setItem(this.storageKey(userId), JSON.stringify(featured));
      } else {
        sessionStorage.removeItem(this.storageKey(userId));
      }
    } catch {
      // The in-memory UI remains functional when browser storage is unavailable.
    }
  }

  clear(userId: string | null | undefined): void {
    if (!userId) return;
    try {
      sessionStorage.removeItem(this.storageKey(userId));
    } catch {
      // No-op when browser storage is unavailable.
    }
  }

  private storageKey(userId: string): string {
    return `jokko.featured-notification.${userId}`;
  }

  private persistentNotification(
    notifications: UserNotificationView[],
  ): UserNotificationView | null {
    const featured = findFeaturedNotification(notifications);
    if (!featured) return null;
    const metadata = featured.data || featured.donnees || {};
    return featured.type === 'PRESTATAIRE_EN_ROUTE' ||
      metadata['persistentUntilTerminal'] === true ||
      metadata['persistentDeliveryOffer'] === true
      ? featured
      : null;
  }
}
