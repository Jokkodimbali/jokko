import { Injectable, computed, signal } from '@angular/core';
import { AppointmentTrackingView } from '../../appointments/domain/appointments.models';
import {
  TrackingConnectionState,
  TrackingMissionEvent,
} from '../data-access/tracking-realtime.service';

@Injectable()
export class TrackingStore {
  private readonly trackingState = signal<AppointmentTrackingView | null>(null);
  private readonly connectionStateValue = signal<TrackingConnectionState>('disconnected');
  private readonly missionEventValue = signal<TrackingMissionEvent | null>(null);

  readonly tracking = this.trackingState.asReadonly();
  readonly connectionState = this.connectionStateValue.asReadonly();
  readonly missionEvent = this.missionEventValue.asReadonly();
  readonly lastUpdatedAt = computed(
    () => this.trackingState()?.lastPositionAt ?? this.trackingState()?.updatedAt ?? null,
  );
  readonly isRealtimeConnected = computed(() => this.connectionStateValue() === 'connected');
  readonly route = computed(() => this.trackingState()?.route ?? null);
  readonly distanceRemainingMeters = computed(() => this.route()?.distanceRemainingMeters ?? null);
  readonly durationRemainingSeconds = computed(
    () => this.route()?.durationRemainingSeconds ?? null,
  );
  readonly estimatedArrivalAt = computed(() => this.route()?.estimatedArrivalAt ?? null);

  setTracking(tracking: AppointmentTrackingView): boolean {
    const current = this.trackingState();
    if (!current) {
      this.trackingState.set(tracking);
      return true;
    }

    const currentTimestamp = this.positionTimestamp(current);
    const incomingTimestamp = this.positionTimestamp(tracking);
    if (
      currentTimestamp !== null &&
      incomingTimestamp !== null &&
      incomingTimestamp < currentTimestamp
    ) {
      return false;
    }

    if (incomingTimestamp !== null && incomingTimestamp === currentTimestamp) {
      this.trackingState.set({
        ...current,
        ...tracking,
        presence: { ...current.presence, ...tracking.presence },
        route: tracking.route ?? current.route,
      });
      return true;
    }

    this.trackingState.set(tracking);
    return true;
  }

  setConnectionState(state: TrackingConnectionState): void {
    this.connectionStateValue.set(state);
  }

  setMissionEvent(event: TrackingMissionEvent): void {
    this.missionEventValue.set(event);
  }

  reset(): void {
    this.trackingState.set(null);
    this.connectionStateValue.set('disconnected');
    this.missionEventValue.set(null);
  }

  private positionTimestamp(tracking: AppointmentTrackingView): number | null {
    const value =
      tracking.lastPositionAt ?? tracking.presence?.lastPositionAt ?? tracking.updatedAt ?? null;
    if (!value) return null;
    const timestamp = Date.parse(value);
    return Number.isFinite(timestamp) ? timestamp : null;
  }
}
