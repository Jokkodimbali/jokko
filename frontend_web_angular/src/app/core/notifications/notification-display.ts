import { signal } from '@angular/core';
import { isPersistentServiceNotification, UserNotificationView } from './notifications.service';

export const NOTIFICATION_DISPLAY_MS = 15_000;
export const NOTIFICATION_TRANSITION_MS = 160;
export const NAVBAR_NOTIFICATION_TRANSITION_MS = 160;

/** Displays notifications immediately and keeps the latest arrival during transitions. */
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
      if (current) this.leave();
      return;
    }

    if (this.phase() === 'leaving') {
      this.enqueue(notification);
      return;
    }
    this.enqueue(notification);
    if (!current) {
      this.showNext();
      return;
    }

    // Active trip states have no timeout. Replace them immediately when the
    // next persisted state arrives (en route -> on site -> completed).
    if (this.isPersistent(current)) {
      this.clearTimers();
      this.showNext();
      return;
    }
    // Replace a transient item after its short exit. Newer arrivals can still
    // supersede the pending one without leaving stale cards on screen.
    this.leave();
  }

  destroy(): void {
    this.clearTimers();
    this.queue.length = 0;
  }

  private enqueue(notification: T): void {
    // The featured slot keeps the newest pending event; older events remain in history.
    this.queue.splice(0, this.queue.length, notification);
  }

  private showNext(): void {
    const notification = this.queue.shift() ?? null;
    this.notification.set(notification);
    if (!notification) {
      this.phase.set('visible');
      return;
    }

    // Mount immediately, then let the content slide in before its display timer starts.
    this.phase.set('entering');
    this.transitionTimer = setTimeout(() => {
      this.transitionTimer = null;
      this.phase.set('visible');
      if (!this.isPersistent(notification)) this.scheduleExpiry(notification);
    }, this.transitionMs);
  }

  private scheduleExpiry(notification: T): void {
    const remainingMs = Math.max(0, this.expiresIn(notification));
    this.expiryTimer = setTimeout(() => {
      this.expiryTimer = null;
      this.dismiss(notification.id);
      this.leave();
    }, remainingMs);
  }

  private leave(): void {
    if (this.phase() === 'leaving') return;
    this.clearTimers();
    this.phase.set('leaving');
    this.transitionTimer = setTimeout(() => {
      this.transitionTimer = null;
      if (this.queue.length > 0) {
        this.showNext();
      } else {
        this.notification.set(null);
        this.phase.set('visible');
      }
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
