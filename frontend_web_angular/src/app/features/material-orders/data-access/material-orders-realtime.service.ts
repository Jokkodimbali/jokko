import { isPlatformBrowser } from '@angular/common';
import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import { io, Socket } from 'socket.io-client';
import { environment } from '../../../../environments/environment';
import { AuthSessionService } from '../../../core/auth/auth-session.service';

type MaterialOrderRealtimeEvent = {
  materialOrderId: string;
  occurredAt: string;
};

@Injectable({ providedIn: 'root' })
export class MaterialOrdersRealtimeService {
  private readonly authSession = inject(AuthSessionService);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly changed = new Subject<string>();
  private socket: Socket | null = null;

  readonly orderChanged$: Observable<string> = this.changed.asObservable();

  connect(): void {
    if (!isPlatformBrowser(this.platformId) || this.socket) return;
    const token = this.authSession.getAccessToken();
    if (!token) return;

    this.socket = io(this.socketUrl(), {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 700,
      reconnectionDelayMax: 3000,
      timeout: 5000,
    });
    this.socket.on('material-order.updated', (event: MaterialOrderRealtimeEvent) => {
      if (typeof event?.materialOrderId === 'string') {
        this.changed.next(event.materialOrderId);
      }
    });
  }

  private socketUrl(): string {
    try {
      return `${new URL(environment.apiUrl).origin}/socket`;
    } catch {
      return environment.apiUrl.replace(/\/api\/v1\/?$/, '/socket');
    }
  }
}
