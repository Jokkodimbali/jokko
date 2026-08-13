import { isPlatformBrowser } from '@angular/common';
import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { BehaviorSubject, Observable, Subject, filter } from 'rxjs';
import { io, Socket } from 'socket.io-client';
import { environment } from '../../../../environments/environment';
import { AuthSessionService } from '../../../core/auth/auth-session.service';
import { AppointmentTrackingView } from '../../appointments/domain/appointments.models';

export type TrackingConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error';

export type TrackingMissionEvent = {
  type: string;
  reservationId: string;
  clientUserId: string;
  professionalId: string;
  occurredAt: string;
  tracking?: AppointmentTrackingView;
};

export type TrackingLocationUpdate = {
  latitude: number;
  longitude: number;
  recordedAt?: string;
  accuracyMeters?: number | null;
  headingDegrees?: number | null;
  speedKmh?: number | null;
  locationLabel?: string | null;
};

type TrackingLocationAcknowledgement = {
  accepted?: boolean;
  tracking?: AppointmentTrackingView;
};

export type TrackingLocationPublishResult = {
  status: 'accepted' | 'rejected' | 'unavailable';
  tracking: AppointmentTrackingView | null;
};

export type TrackingRouteSelection = {
  reservationId: string;
  routeId: string;
  coordinates: Array<{ lat: number; lng: number }>;
  distanceKm: number | null;
  durationMinutes: number | null;
  navigationSteps: Array<{
    id: string;
    instruction: string;
    maneuver: string | null;
    distanceMeters: number | null;
    start: { lat: number; lng: number } | null;
    end: { lat: number; lng: number } | null;
  }>;
  selectedAt: string;
};

// The backend enriches the first position with a route estimate before acknowledging it.
// Keep WebSocket as the primary transport instead of needlessly falling back to HTTP.
const LOCATION_ACK_TIMEOUT_MS = 6_000;

@Injectable({ providedIn: 'root' })
export class TrackingRealtimeService {
  private readonly authSession = inject(AuthSessionService);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly updates = new Subject<AppointmentTrackingView>();
  private readonly missionUpdates = new Subject<TrackingMissionEvent>();
  private readonly routeSelections = new Subject<TrackingRouteSelection>();
  private readonly connectionState = new BehaviorSubject<TrackingConnectionState>('disconnected');
  private readonly reservationIds = new Set<string>();
  private readonly pendingRouteSelections = new Map<string, TrackingRouteSelection>();
  private socket: Socket | null = null;

  readonly connectionState$ = this.connectionState.asObservable();
  readonly missionUpdated$ = this.missionUpdates.asObservable();
  readonly routeSelected$ = this.routeSelections.asObservable();

  watchReservation(reservationId: string): Observable<AppointmentTrackingView> {
    this.reservationIds.add(reservationId);
    this.connect();
    this.subscribeToReservation(reservationId);

    return this.updates.pipe(filter((tracking) => tracking.reservationId === reservationId));
  }

  stopWatching(reservationId: string): void {
    this.reservationIds.delete(reservationId);
    this.socket?.emit('tracking.unsubscribe', { reservationId });
  }

  publishLocation(
    reservationId: string,
    location: TrackingLocationUpdate,
  ): Promise<TrackingLocationPublishResult> {
    this.connect();
    if (!this.socket?.connected) {
      return Promise.resolve({ status: 'unavailable', tracking: null });
    }

    return new Promise((resolve) => {
      let settled = false;
      const finish = (result: TrackingLocationPublishResult) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeoutId);
        resolve(result);
      };
      const timeoutId = setTimeout(
        () => finish({ status: 'unavailable', tracking: null }),
        LOCATION_ACK_TIMEOUT_MS,
      );
      this.socket?.emit(
        'tracking.location.update',
        { reservationId, ...location },
        (response?: TrackingLocationAcknowledgement) => {
          if (!response) {
            finish({ status: 'unavailable', tracking: null });
            return;
          }
          finish({
            status: response.accepted === true ? 'accepted' : 'rejected',
            tracking: response.tracking ?? null,
          });
        },
      );
    });
  }

  publishRouteSelection(selection: TrackingRouteSelection): void {
    this.connect();
    if (this.socket?.connected) {
      this.socket.emit('tracking.route.select', selection);
      this.pendingRouteSelections.delete(selection.reservationId);
    } else {
      // Latest-only: a reconnect publishes only the most recent selection.
      this.pendingRouteSelections.set(selection.reservationId, selection);
    }
  }

  disconnect(): void {
    this.socket?.disconnect();
    this.socket = null;
    this.reservationIds.clear();
    this.pendingRouteSelections.clear();
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
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 5000,
    });
    this.socket.on('connect', () => {
      this.connectionState.next('connected');
      this.reservationIds.forEach((reservationId) => this.subscribeToReservation(reservationId));
      this.pendingRouteSelections.forEach((selection) =>
        this.socket?.emit('tracking.route.select', selection),
      );
      this.pendingRouteSelections.clear();
    });
    this.socket.on('disconnect', () => {
      this.connectionState.next('disconnected');
    });
    this.socket.on('connect_error', () => {
      this.connectionState.next('error');
    });
    this.socket.on('tracking.snapshot', (tracking: AppointmentTrackingView) =>
      this.updates.next(tracking),
    );
    this.socket.on('tracking.location.updated', (tracking: AppointmentTrackingView) =>
      this.updates.next(tracking),
    );
    this.socket.on('tracking.mission.updated', (event: TrackingMissionEvent) => {
      this.missionUpdates.next(event);
      this.subscribeToReservation(event.reservationId);
    });
    this.socket.on('tracking.route.selected', (selection: TrackingRouteSelection) =>
      this.routeSelections.next(selection),
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
