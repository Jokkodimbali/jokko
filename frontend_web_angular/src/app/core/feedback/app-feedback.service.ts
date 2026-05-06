import { Injectable, signal } from '@angular/core';

export interface AppFeedbackMessage {
  id: number;
  type: 'success';
  text: string;
}

@Injectable({
  providedIn: 'root',
})
export class AppFeedbackService {
  private readonly messageSignal = signal<AppFeedbackMessage | null>(null);
  private hideTimer: ReturnType<typeof setTimeout> | null = null;

  readonly message = this.messageSignal.asReadonly();

  success(text: string): void {
    if (this.hideTimer) {
      clearTimeout(this.hideTimer);
    }

    this.messageSignal.set({
      id: Date.now(),
      type: 'success',
      text,
    });

    this.hideTimer = setTimeout(() => {
      this.messageSignal.set(null);
      this.hideTimer = null;
    }, 3500);
  }

  clear(): void {
    if (this.hideTimer) {
      clearTimeout(this.hideTimer);
      this.hideTimer = null;
    }

    this.messageSignal.set(null);
  }
}
