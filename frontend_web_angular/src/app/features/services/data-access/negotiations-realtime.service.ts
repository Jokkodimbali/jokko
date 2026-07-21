import { isPlatformBrowser } from '@angular/common';
import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import { io, Socket } from 'socket.io-client';
import { environment } from '../../../../environments/environment';
import { AuthSessionService } from '../../../core/auth/auth-session.service';
import { NegotiationScope, NegotiationView } from './service-proposal.service';

export interface NegotiationRealtimeEvent {
  type: string;
  negotiationId: string;
  clientId: string;
  professionalId: string;
  occurredAt: string;
  negotiation?: NegotiationView;
}

@Injectable({ providedIn: 'root' })
export class NegotiationsRealtimeService {
  private readonly authSession = inject(AuthSessionService);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly updates = new Subject<NegotiationRealtimeEvent>();
  private readonly scopes = new Set<NegotiationScope>();
  private socket: Socket | null = null;

  watchMyNegotiations(scope: NegotiationScope): Observable<NegotiationRealtimeEvent> {
    this.scopes.add(scope);
    this.connect();
    this.subscribeToScope(scope);

    return this.updates.asObservable();
  }

  stopWatching(scope: NegotiationScope): void {
    this.scopes.delete(scope);
  }

  disconnect(): void {
    this.socket?.disconnect();
    this.socket = null;
    this.scopes.clear();
  }

  private connect(): void {
    if (!isPlatformBrowser(this.platformId) || this.socket) return;

    const token = this.authSession.getAccessToken();
    if (!token) return;

    this.socket = io(this.socketUrl(), {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 700,
      reconnectionDelayMax: 3000,
    });

    this.socket.on('connect', () => {
      this.scopes.forEach((scope) => this.subscribeToScope(scope));
    });
    this.socket.on('negotiation.updated', (event: NegotiationRealtimeEvent) => {
      this.updates.next(event);
    });
  }

  private subscribeToScope(scope: NegotiationScope): void {
    if (this.socket?.connected) {
      this.socket.emit('negotiations.subscribe', { scope });
    }
  }

  private socketUrl(): string {
    try {
      return `${new URL(environment.apiUrl).origin}/socket`;
    } catch {
      return environment.apiUrl.replace(/\/api\/v1\/?$/, '/socket');
    }
  }
}
