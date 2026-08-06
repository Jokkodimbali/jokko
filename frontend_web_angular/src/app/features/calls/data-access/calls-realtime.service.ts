import { isPlatformBrowser } from '@angular/common';
import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { Subject } from 'rxjs';
import { io, type Socket } from 'socket.io-client';
import { environment } from '../../../../environments/environment';
import { AuthSessionService } from '../../../core/auth/auth-session.service';
import type { CallSignal } from '../domain/call.models';

@Injectable({ providedIn: 'root' })
export class CallsRealtimeService {
  private readonly auth = inject(AuthSessionService);
  private readonly platformId = inject(PLATFORM_ID);
  private socket: Socket | null = null;
  private readonly events = new Subject<{ type: string; signal: CallSignal }>();
  readonly events$ = this.events.asObservable();

  connect(): void {
    if (!isPlatformBrowser(this.platformId) || this.socket?.connected) return;
    const token = this.auth.getAccessToken();
    if (!token) return;
    this.socket = io(`${new URL(environment.apiUrl).origin}/calls`, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
    });
    for (const type of [
      'call.incoming',
      'call.initiated',
      'call.accepted',
      'call.rejected',
      'call.ended',
      'call.missed',
    ]) {
      this.socket.on(type, (signal: CallSignal) => this.events.next({ type, signal }));
    }
  }

  emit(
    type: 'call.initiate' | 'call.accept' | 'call.reject' | 'call.end',
    signal: Pick<CallSignal, 'callId' | 'conversationId' | 'kind'>,
  ): void {
    this.connect();
    this.socket?.emit(type, signal);
  }

  disconnect(): void {
    this.socket?.disconnect();
    this.socket = null;
  }
}
