import { signal } from '@angular/core';
import { isPersistentServiceNotification, UserNotificationView } from './notifications.service';

export const NOTIFICATION_DISPLAY_MS = 15_000;
export const NOTIFICATION_TRANSITION_MS = 350;

/** Retains the rendered notification until its exit animation finishes. */
export class AnimatedNotificationDisplay<T extends { id: string }> {
  readonly notification = signal<T | null>(null);
  readonly phase = signal<'entering' | 'visible' | 'leaving'>('visible');
  private pending: T | null = null;
  private transitionTimer: ReturnType<typeof setTimeout> | null = null;
  private expiryTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly dismiss: (id: string) => void,
    private readonly isPersistent: (notification: T) => boolean,
  ) {}

  update(notification: T | null): void {
    this.pending = notification;
    if (this.phase() === 'leaving') return;
    const current = this.notification();
    if (current?.id === notification?.id) {
      this.notification.set(notification);
      return; // Polling must not restart the animation or the expiry timer.
    }
    if (current) this.leave();
    else this.showPending();
  }

  destroy(): void {
    if (this.transitionTimer) clearTimeout(this.transitionTimer);
    if (this.expiryTimer) clearTimeout(this.expiryTimer);
    this.transitionTimer = null;
    this.expiryTimer = null;
  }

  private showPending(): void {
    const notification = this.pending;
    this.notification.set(notification);
    if (!notification) {
      this.phase.set('visible');
      return;
    }
    this.phase.set('entering');
    this.transitionTimer = setTimeout(() => {
      this.transitionTimer = null;
      this.phase.set('visible');
      if (!this.isPersistent(notification)) {
        this.expiryTimer = setTimeout(() => {
          this.expiryTimer = null;
          this.pending = null;
          this.leave();
          this.dismiss(notification.id);
        }, NOTIFICATION_DISPLAY_MS);
      }
    }, NOTIFICATION_TRANSITION_MS);
  }

  private leave(): void {
    this.destroy();
    this.phase.set('leaving');
    this.transitionTimer = setTimeout(() => {
      this.transitionTimer = null;
      this.showPending();
    }, NOTIFICATION_TRANSITION_MS);
  }
}

export class NotificationDisplay extends AnimatedNotificationDisplay<UserNotificationView> {
  constructor(dismiss: (id: string) => void) {
    super(dismiss, isPersistentServiceNotification);
  }
}
