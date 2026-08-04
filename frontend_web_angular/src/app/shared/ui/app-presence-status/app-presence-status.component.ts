import { Component, Input, inject } from '@angular/core';
import { SessionPresenceService } from '../../../core/presence/session-presence.service';
import { AppPresenceDotComponent } from '../app-presence-dot/app-presence-dot.component';

@Component({
  selector: 'app-presence-status',
  standalone: true,
  imports: [AppPresenceDotComponent],
  template: `
    <app-presence-dot
      [userId]="userId"
      [professionalId]="professionalId"
      [initialOnline]="initialOnline"
    />
    <span>{{ isOnline() ? onlineLabel : offlineLabel }}</span>
  `,
  styleUrl: './app-presence-status.component.scss',
})
export class AppPresenceStatusComponent {
  private readonly presence = inject(SessionPresenceService);

  @Input() userId: string | null | undefined;
  @Input() professionalId: string | null | undefined;
  @Input() initialOnline = false;
  @Input() onlineLabel = 'En ligne';
  @Input() offlineLabel = 'Hors ligne';

  protected isOnline(): boolean {
    return this.presence.isOnlineFor(this.userId, this.professionalId, this.initialOnline);
  }
}
