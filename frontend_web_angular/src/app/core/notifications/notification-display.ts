import { signal } from '@angular/core';
import { isPersistentServiceNotification, UserNotificationView } from './notifications.service';

export const NOTIFICATION_DISPLAY_MS = 15_000;
export const NOTIFICATION_TRANSITION_MS = 160;
export const NAVBAR_NOTIFICATION_TRANSITION_MS = 160;

/** Displays notifications immediately and serializes simultaneous arrivals. */
export class AnimatedNotificationDisplay<T extends { id: string }> {
  readonly notification = signal<T | null>(null);
  readonly phase = signal<'entering' | 'visible' | 'leaving'>('visible');
  private readonly queue: T[] = [];
  private transitionTimer: ReturnType<typeof setTimeout> | null = null;
  private expiryTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly dismiss: (id: string) => void,
    private readonly isPersistent: (notification: T) => boolean,
    private readonly transitionMs = NOTIFICATION_TRANSITION_MS,
    private readonly expiresIn: (notification: T) => number = () => NOTIFICATION_DISPLAY_MS,
  ) {}

  update(notification: T | null): void {
    const current = this.notification();
    if (current?.id === notification?.id) {
      this.notification.set(notification);
      return;
    }

    if (!notification) {
      this.queue.length = 0;
      if (current && this.isPersistent(current)) this.leave();
      return;
    }

    this.enqueue(notification);
    if (!current) {
      this.showNext(false);
      return;
    }

    // Active trip states have no timeout. Replace them immediately when the
    // next persisted state arrives (en route -> on site -> completed).
    if (this.isPersistent(current)) {
      this.clearTimers();
      this.showNext(true);
    }
    // A transient item keeps its full deadline. Concurrent notifications stay
    // queued and are mounted one by one, never on top of each other.
  }

  destroy(): void {
    this.clearTimers();
    this.queue.length = 0;
  }

  private enqueue(notification: T): void {
    const index = this.queue.findIndex((queued) => queued.id === notification.id);
    if (index >= 0) {
      this.queue[index] = notification;
      return;
    }
    this.queue.push(notification);
  }

  private showNext(animateReplacement: boolean): void {
    const notification = this.queue.shift() ?? null;
    this.notification.set(notification);
    if (!notification) {
      this.phase.set('visible');
      return;
    }

    // The node is mounted synchronously. The short animation only polishes a
    // replacement and never delays access to its content.
    this.phase.set(animateReplacement ? 'entering' : 'visible');
    if (animateReplacement) {
      this.transitionTimer = setTimeout(() => {
        this.transitionTimer = null;
        this.phase.set('visible');
      }, this.transitionMs);
    }

    if (this.isPersistent(notification)) return;
    const remainingMs = Math.max(0, this.expiresIn(notification));
    this.expiryTimer = setTimeout(() => {
      this.expiryTimer = null;
      this.dismiss(notification.id);
      if (this.queue.length > 0) {
        this.clearTimers();
        this.showNext(true);
      } else {
        this.leave();
      }
    }, remainingMs);
  }

  private leave(): void {
    this.clearTimers();
    this.phase.set('leaving');
    this.transitionTimer = setTimeout(() => {
      this.transitionTimer = null;
      this.notification.set(null);
      this.phase.set('visible');
    }, this.transitionMs);
  }

  private clearTimers(): void {
    if (this.transitionTimer) clearTimeout(this.transitionTimer);
    if (this.expiryTimer) clearTimeout(this.expiryTimer);
    this.transitionTimer = null;
    this.expiryTimer = null;
  }
}

export class NotificationDisplay extends AnimatedNotificationDisplay<UserNotificationView> {
  constructor(dismiss: (id: string) => void) {
    super(
      dismiss,
      isPersistentServiceNotification,
      NAVBAR_NOTIFICATION_TRANSITION_MS,
      (notification) =>
        notification.displayExpiresAt
          ? notification.displayExpiresAt - Date.now()
          : NOTIFICATION_DISPLAY_MS,
    );
  }
}
