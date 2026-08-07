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

  setTracking(tracking: AppointmentTrackingView): void {
    this.trackingState.set(tracking);
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
}
