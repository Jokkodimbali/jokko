import { Injectable } from '@angular/core';
import { NOTIFICATION_DISPLAY_MS } from './notification-display';
import {
  findFeaturedNotification,
  isPersistentServiceNotification,
  UserNotificationView,
} from './notifications.service';

type CachedFeaturedNotification = {
  notification: UserNotificationView;
  expiresAt: number | null;
};

/** Preserves the active notification and its deadline while the navbar is recreated. */
@Injectable({ providedIn: 'root' })
export class FeaturedNotificationCacheService {
  private readonly dismissedTransientNotificationIds = new Set<string>();

  isTransientDismissed(notificationId: string): boolean {
    if (this.dismissedTransientNotificationIds.has(notificationId)) return true;
    try {
      return this.readDismissedIds().includes(notificationId);
    } catch {
      return false;
    }
  }

  dismissTransient(notificationId: string): void {
    this.dismissedTransientNotificationIds.add(notificationId);
    try {
      const ids = this.readDismissedIds().filter((id) => id !== notificationId);
      sessionStorage.setItem(
        this.dismissedStorageKey(),
        JSON.stringify([...ids.slice(-99), notificationId]),
      );
    } catch {
      // The in-memory state remains functional when storage is unavailable.
    }
  }

  read(userId: string | null | undefined): UserNotificationView | null {
    if (!userId) return null;
    try {
      const raw = sessionStorage.getItem(this.storageKey(userId));
      if (!raw) return null;
      const parsed = JSON.parse(raw) as CachedFeaturedNotification | UserNotificationView;
      const cached = this.normalizeCachedValue(parsed);
      if (!cached) return null;
      if (cached.expiresAt !== null && cached.expiresAt <= Date.now()) {
        this.dismissTransient(cached.notification.id);
        sessionStorage.removeItem(this.storageKey(userId));
        return null;
      }
      return {
        ...cached.notification,
        ...(cached.expiresAt === null ? {} : { displayExpiresAt: cached.expiresAt }),
      };
    } catch {
      return null;
    }
  }

  sync(userId: string | null | undefined, notifications: UserNotificationView[]): void {
    if (!userId) return;
    const featured = findFeaturedNotification(notifications, (id) => this.isTransientDismissed(id));
    try {
      if (!featured) {
        sessionStorage.removeItem(this.storageKey(userId));
        return;
      }

      const persistent = isPersistentServiceNotification(featured);
      const current = this.readCachedRecord(userId);
      const expiresAt = persistent
        ? null
        : current?.notification.id === featured.id && current.expiresAt
          ? current.expiresAt
          : Date.now() + NOTIFICATION_DISPLAY_MS;
      sessionStorage.setItem(
        this.storageKey(userId),
        JSON.stringify({ notification: featured, expiresAt } satisfies CachedFeaturedNotification),
      );
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

  private readCachedRecord(userId: string): CachedFeaturedNotification | null {
    const raw = sessionStorage.getItem(this.storageKey(userId));
    return raw ? this.normalizeCachedValue(JSON.parse(raw)) : null;
  }

  private normalizeCachedValue(
    value: CachedFeaturedNotification | UserNotificationView,
  ): CachedFeaturedNotification | null {
    const wrapped = value as CachedFeaturedNotification;
    if (wrapped.notification?.id && 'expiresAt' in wrapped) return wrapped;

    const legacyNotification = value as UserNotificationView;
    if (!legacyNotification.id || !isPersistentServiceNotification(legacyNotification)) return null;
    return { notification: legacyNotification, expiresAt: null };
  }

  private readDismissedIds(): string[] {
    const raw = sessionStorage.getItem(this.dismissedStorageKey());
    if (!raw) return [];
    const values = JSON.parse(raw) as unknown;
    return Array.isArray(values)
      ? values.filter((value): value is string => typeof value === 'string')
      : [];
  }

  private storageKey(userId: string): string {
    return `jokko.featured-notification.${userId}`;
  }

  private dismissedStorageKey(): string {
    return 'jokko.dismissed-featured-notifications';
  }
}
