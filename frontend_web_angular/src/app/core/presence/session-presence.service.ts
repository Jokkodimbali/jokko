import { isPlatformBrowser } from '@angular/common';
import { Injectable, PLATFORM_ID, effect, inject, signal } from '@angular/core';
import { io, Socket } from 'socket.io-client';
import { environment } from '../../../environments/environment';
import { AuthSessionService } from '../auth/auth-session.service';
import { clearHttpResponseCache } from '../http/http-cache.interceptor';

export interface RealtimeProfessionalProfile {
  userId: string;
  professionalId: string;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
}

@Injectable({ providedIn: 'root' })
export class SessionPresenceService {
  private readonly authSession = inject(AuthSessionService);
  private readonly platformId = inject(PLATFORM_ID);
  private socket: Socket | null = null;
  private publicSocket: Socket | null = null;
  private readonly statuses = signal<Record<string, boolean>>({});
  private readonly profiles = signal<Record<string, RealtimeProfessionalProfile>>({});

  constructor() {
    this.connectToPublicPresence();
    effect(() => {
      const user = this.authSession.currentUser();
      if (!user) {
        this.disconnect();
        return;
      }

      queueMicrotask(() => this.connect());
    });
  }

  isOnline(identifier: string | null | undefined, fallback = false): boolean {
    if (!identifier) return fallback;
    return this.statuses()[identifier] ?? fallback;
  }

  isOnlineFor(
    userId: string | null | undefined,
    professionalId: string | null | undefined,
    fallback = false,
  ): boolean {
    return this.isOnline(professionalId, this.isOnline(userId, fallback));
  }

  professionalProfile(
    userId: string | null | undefined,
    professionalId: string | null | undefined,
  ): RealtimeProfessionalProfile | null {
    const profiles = this.profiles();
    return (
      (professionalId ? profiles[professionalId] : null) ??
      (userId ? profiles[userId] : null) ??
      null
    );
  }

  disconnectAuthenticatedSession(): void {
    const socket = this.socket;
    if (!socket) return;

    const finishDisconnect = (): void => {
      socket.disconnect();
      if (this.socket === socket) this.socket = null;
    };
    socket.timeout(1500).emit('session.logout', () => finishDisconnect());
  }

  private connect(): void {
    if (!isPlatformBrowser(this.platformId) || this.socket) return;
    const token = this.authSession.getAccessToken();
    if (!token) return;

    this.socket = io(this.socketUrl(), {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });
  }

  private disconnect(): void {
    this.socket?.disconnect();
    this.socket = null;
  }

  private connectToPublicPresence(): void {
    if (!isPlatformBrowser(this.platformId) || this.publicSocket) return;
    this.publicSocket = io(this.publicSocketUrl(), {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });
    this.publicSocket.on(
      'catalog.presence.changed',
      (event: { userId?: string; professionalId?: string; isOnline: boolean }) =>
        this.applyPresence(event),
    );
    this.publicSocket.on(
      'catalog.presence.snapshot',
      (events: Array<{ userId?: string; professionalId?: string; isOnline: boolean }>) =>
        events.forEach((event) => this.applyPresence(event)),
    );
    this.publicSocket.on('catalog.profile.changed', (event: RealtimeProfessionalProfile) => {
      clearHttpResponseCache();
      this.profiles.update((profiles) => ({
        ...profiles,
        [event.userId]: event,
        [event.professionalId]: event,
      }));
    });
  }

  private applyPresence(event: {
    userId?: string;
    professionalId?: string;
    isOnline: boolean;
  }): void {
    const identifiers = [event.userId, event.professionalId].filter(
      (identifier): identifier is string => Boolean(identifier),
    );
    if (!identifiers.length) return;
    this.statuses.update((statuses) => {
      const next = { ...statuses };
      identifiers.forEach((identifier) => (next[identifier] = event.isOnline));
      return next;
    });
  }

  private socketUrl(): string {
    try {
      return `${new URL(environment.apiUrl).origin}/socket`;
    } catch {
      return environment.apiUrl.replace(/\/api\/v1\/?$/, '/socket');
    }
  }

  private publicSocketUrl(): string {
    try {
      return `${new URL(environment.apiUrl).origin}/public-catalog`;
    } catch {
      return environment.apiUrl.replace(/\/api\/v1\/?$/, '/public-catalog');
    }
  }
}
