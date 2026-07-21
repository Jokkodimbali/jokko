import { isPlatformBrowser } from '@angular/common';
import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { BehaviorSubject, Observable, Subject, filter } from 'rxjs';
import { io, Socket } from 'socket.io-client';
import { environment } from '../../../../environments/environment';
import { AuthSessionService } from '../../../core/auth/auth-session.service';
import { AppointmentTrackingView } from '../../appointments/domain/appointments.models';

export type TrackingConnectionState =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'error';

export type TrackingMissionEvent = {
  type: string;
  reservationId: string;
  clientUserId: string;
  professionalId: string;
  occurredAt: string;
  tracking?: AppointmentTrackingView;
};

@Injectable({ providedIn: 'root' })
export class TrackingRealtimeService {
  private readonly authSession = inject(AuthSessionService);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly updates = new Subject<AppointmentTrackingView>();
  private readonly missionUpdates = new Subject<TrackingMissionEvent>();
  private readonly connectionState = new BehaviorSubject<TrackingConnectionState>(
    'disconnected',
  );
  private readonly reservationIds = new Set<string>();
  private socket: Socket | null = null;

  readonly connectionState$ = this.connectionState.asObservable();
  readonly missionUpdated$ = this.missionUpdates.asObservable();

  watchReservation(reservationId: string): Observable<AppointmentTrackingView> {
    this.reservationIds.add(reservationId);
    this.connect();
    this.subscribeToReservation(reservationId);

    return this.updates.pipe(
      filter((tracking) => tracking.reservationId === reservationId),
    );
  }

  stopWatching(reservationId: string): void {
    this.reservationIds.delete(reservationId);
    this.socket?.emit('tracking.unsubscribe', { reservationId });
  }

  disconnect(): void {
    this.socket?.disconnect();
    this.socket = null;
    this.reservationIds.clear();
    this.connectionState.next('disconnected');
  }

  private connect(): void {
    if (!isPlatformBrowser(this.platformId) || this.socket) {
      return;
    }

    const token = this.authSession.getAccessToken();
    if (!token) {
      this.connectionState.next('error');
      return;
    }

    this.connectionState.next('connecting');
    this.socket = io(this.socketUrl(), {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
    });
    this.socket.on('connect', () => {
      this.connectionState.next('connected');
      this.reservationIds.forEach((reservationId) =>
        this.subscribeToReservation(reservationId),
      );
    });
    this.socket.on('disconnect', () => {
      this.connectionState.next('disconnected');
    });
    this.socket.on('connect_error', () => {
      this.connectionState.next('error');
    });
    this.socket.on(
      'tracking.snapshot',
      (tracking: AppointmentTrackingView) => this.updates.next(tracking),
    );
    this.socket.on(
      'tracking.location.updated',
      (tracking: AppointmentTrackingView) => this.updates.next(tracking),
    );
    this.socket.on(
      'tracking.mission.updated',
      (event: TrackingMissionEvent) => {
        this.missionUpdates.next(event);
        this.subscribeToReservation(event.reservationId);
      },
    );
  }

  private subscribeToReservation(reservationId: string): void {
    if (this.socket?.connected) {
      this.socket.emit('tracking.subscribe', { reservationId });
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
