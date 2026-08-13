import { DOCUMENT, isPlatformBrowser } from '@angular/common';
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
  private readonly document = inject(DOCUMENT);
  private readonly updates = new Subject<NegotiationRealtimeEvent>();
  private readonly scopes = new Set<NegotiationScope>();
  private socket: Socket | null = null;

  constructor() {
    if (!isPlatformBrowser(this.platformId)) return;

    window.addEventListener('online', this.resumeConnection);
    window.addEventListener('focus', this.resumeConnection);
    this.document.addEventListener('visibilitychange', this.handleVisibilityChange);
  }

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
    if (!isPlatformBrowser(this.platformId)) return;

    const token = this.authSession.getAccessToken();
    if (!token) return;

    if (this.socket) {
      this.socket.auth = { token };
      if (!this.socket.connected) {
        this.socket.connect();
      }
      return;
    }

    this.socket = io(this.socketUrl(), {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 700,
      reconnectionDelayMax: 3000,
      timeout: 5000,
    });

    this.socket.on('connect', () => {
      this.scopes.forEach((scope) => this.subscribeToScope(scope));
    });
    this.socket.on('negotiation.updated', (event: NegotiationRealtimeEvent) => {
      this.updates.next(event);
    });
  }

  private readonly handleVisibilityChange = (): void => {
    if (!this.document.hidden) {
      this.resumeConnection();
    }
  };

  private readonly resumeConnection = (): void => {
    if (this.scopes.size === 0) return;
    this.connect();
    this.scopes.forEach((scope) => this.subscribeToScope(scope));
  };

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
