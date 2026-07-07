import { isPlatformBrowser } from '@angular/common';
import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { Observable, Subject, filter } from 'rxjs';
import { io, Socket } from 'socket.io-client';
import { environment } from '../../../../environments/environment';
import { AuthSessionService } from '../../../core/auth/auth-session.service';

export interface ProfessionalAvailabilityChangedEvent {
  professionalId: string;
  changedAt: string;
  reason: 'availability' | 'service';
}

@Injectable({ providedIn: 'root' })
export class AvailabilityRealtimeService {
  private readonly authSession = inject(AuthSessionService);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly changes = new Subject<ProfessionalAvailabilityChangedEvent>();
  private readonly professionalIds = new Set<string>();
  private socket: Socket | null = null;

  watchProfessional(professionalId: string): Observable<ProfessionalAvailabilityChangedEvent> {
    this.professionalIds.add(professionalId);
    this.connect();
    this.subscribeToProfessional(professionalId);

    return this.changes.pipe(
      filter((event) => event.professionalId === professionalId),
    );
  }

  stopWatching(professionalId: string): void {
    this.professionalIds.delete(professionalId);
    this.socket?.emit('professional.availability.unsubscribe', { professionalId });
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

    this.socket.on('connect', () => {
      this.professionalIds.forEach((professionalId) =>
        this.subscribeToProfessional(professionalId),
      );
    });
    this.socket.on('professional.availability.changed', (event: ProfessionalAvailabilityChangedEvent) => {
      this.changes.next(event);
    });
  }

  private subscribeToProfessional(professionalId: string): void {
    if (this.socket?.connected) {
      this.socket.emit('professional.availability.subscribe', { professionalId });
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
