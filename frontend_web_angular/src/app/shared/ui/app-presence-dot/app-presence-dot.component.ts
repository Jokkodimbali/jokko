import { Component, Input, inject } from '@angular/core';
import { SessionPresenceService } from '../../../core/presence/session-presence.service';

@Component({
  selector: 'app-presence-dot',
  standalone: true,
  template: '',
  styleUrl: './app-presence-dot.component.scss',
  host: {
    '[class.app-presence-dot--online]': 'isOnline()',
    '[attr.aria-label]': "isOnline() ? 'En ligne' : 'Hors ligne'",
    role: 'status',
  },
})
export class AppPresenceDotComponent {
  private readonly presence = inject(SessionPresenceService);

  @Input() userId: string | null | undefined;
  @Input() professionalId: string | null | undefined;
  @Input() initialOnline = false;

  protected isOnline(): boolean {
    return this.presence.isOnlineFor(this.userId, this.professionalId, this.initialOnline);
  }
}
