import { isPlatformBrowser } from '@angular/common';
import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import { io, Socket } from 'socket.io-client';
import { environment } from '../../../../environments/environment';

export interface CatalogAccountStatusChangedEvent {
  userId: string;
  professionalId: string | null;
  active: boolean;
  changedAt: string;
}

export interface CatalogProfileChangedEvent {
  userId: string;
  professionalId: string;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  changedAt: string;
}

@Injectable({ providedIn: 'root' })
export class CatalogRealtimeService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly changes = new Subject<CatalogAccountStatusChangedEvent>();
  private readonly profileChanges = new Subject<CatalogProfileChangedEvent>();
  private socket: Socket | null = null;

  watchAccountStatuses(): Observable<CatalogAccountStatusChangedEvent> {
    this.connect();
    return this.changes.asObservable();
  }

  watchProfiles(): Observable<CatalogProfileChangedEvent> {
    this.connect();
    return this.profileChanges.asObservable();
  }

  private connect(): void {
    if (!isPlatformBrowser(this.platformId) || this.socket) return;

    this.socket = io(this.socketUrl(), {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 5000,
    });
    this.socket.on('catalog.account-status.changed', (event: CatalogAccountStatusChangedEvent) => {
      this.changes.next(event);
    });
    this.socket.on('catalog.profile.changed', (event: CatalogProfileChangedEvent) => {
      this.profileChanges.next(event);
    });
  }

  private socketUrl(): string {
    try {
      return `${new URL(environment.apiUrl).origin}/public-catalog`;
    } catch {
      return environment.apiUrl.replace(/\/api\/v1\/?$/, '/public-catalog');
    }
  }
}
