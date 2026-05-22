import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { LucideAngularModule } from 'lucide-angular';
import { catchError, of } from 'rxjs';
import { AdminBroadcastPayload, AdminBroadcastResult } from '../../../data-access/admin.models';
import { AdminNotificationsService } from '../../../data-access/admin-notifications.service';

@Component({
  selector: 'app-admin-notifications-panel',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideAngularModule],
  templateUrl: './admin-notifications-panel.component.html',
  styleUrl: './admin-notifications-panel.component.scss',
})
export class AdminNotificationsPanelComponent {
  private readonly notifications = inject(AdminNotificationsService);
  protected readonly result = signal<AdminBroadcastResult | null>(null);
  protected readonly isSending = signal(false);
  protected readonly error = signal('');
  protected confirmOpen = false;
  protected target: AdminBroadcastPayload['target'] = 'ALL';
  protected title = '';
  protected body = '';
  protected contextJson = '';

  protected requestBroadcast(): void {
    if (!this.title.trim() || !this.body.trim()) return;
    this.error.set('');
    this.confirmOpen = true;
  }

  protected send(): void {
    const data = this.parseData();
    if (data === null) return;
    this.isSending.set(true);
    this.notifications
      .broadcast({
        target: this.target,
        title: this.title.trim(),
        body: this.body.trim(),
        ...(data ? { data } : {}),
      })
      .pipe(
        catchError(() => {
          this.error.set('La notification n a pas pu etre envoyee.');
          return of(null);
        }),
      )
      .subscribe((result) => {
        if (result) {
          this.result.set(result);
          this.title = '';
          this.body = '';
          this.contextJson = '';
        }
        this.confirmOpen = false;
        this.isSending.set(false);
      });
  }

  private parseData(): Record<string, unknown> | undefined | null {
    if (!this.contextJson.trim()) return undefined;
    try {
      const parsed = JSON.parse(this.contextJson) as unknown;
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) throw new Error();
      return parsed as Record<string, unknown>;
    } catch {
      this.error.set('Les donnees optionnelles doivent etre un objet JSON valide.');
      this.confirmOpen = false;
      return null;
    }
  }
}
