import { isPlatformBrowser } from '@angular/common';
import { Injectable, PLATFORM_ID, inject, signal } from '@angular/core';
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
  private connectedToken: string | null = null;
  private readonly events = new Subject<{ type: string; signal: CallSignal }>();
  readonly events$ = this.events.asObservable();
  readonly connectionVersion = signal(0);

  connect(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    const token = this.auth.getAccessToken();
    if (!token) return;
    if (this.socket && this.connectedToken === token) {
      if (!this.socket.connected) this.socket.connect();
      return;
    }
    this.disconnect();
    this.connectedToken = token;
    this.socket = io(`${new URL(environment.apiUrl).origin}/calls`, {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
    });
    this.socket.on('connect', () => this.connectionVersion.update((version) => version + 1));
    for (const type of [
      'call.incoming',
      'call.initiated',
      'call.accepted',
      'call.answered-elsewhere',
      'call.rejected',
      'call.ended',
      'call.missed',
    ]) {
      this.socket.on(type, (signal: CallSignal) => this.events.next({ type, signal }));
    }
  }

  async emit(
    type: 'call.initiate' | 'call.accept' | 'call.reject' | 'call.end',
    signal: Pick<CallSignal, 'callId' | 'conversationId' | 'kind'>,
  ): Promise<CallSignal> {
    this.connect();
    const socket = this.socket;
    if (!socket) throw new Error("La signalisation d'appel est indisponible.");
    const payload = {
      callId: signal.callId,
      conversationId: signal.conversationId,
      kind: signal.kind,
    };
    let lastError: unknown;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        return await new Promise<CallSignal>((resolve, reject) => {
          socket
            .timeout(5000)
            .emit(
              type,
            payload,
              (error: Error | null, response?: { ok?: boolean; data?: CallSignal }) => {
                if (error || !response?.ok || !response.data) {
                  reject(error ?? new Error("Le serveur n'a pas confirme l'action."));
                  return;
                }
                resolve(response.data);
              },
            );
        });
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError ?? new Error("Le serveur n'a pas confirme l'action.");
  }

  disconnect(): void {
    this.socket?.removeAllListeners();
    this.socket?.disconnect();
    this.socket = null;
    this.connectedToken = null;
  }
}
