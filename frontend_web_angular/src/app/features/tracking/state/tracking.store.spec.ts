import { TrackingStore } from './tracking.store';
import type { AppointmentTrackingView } from '../../appointments/domain/appointments.models';

describe('TrackingStore', () => {
  it('derives route metrics and resets all realtime state', () => {
    const store = new TrackingStore();
    const tracking = {
      reservationId: 'reservation-id',
      lastPositionAt: '2026-06-24T14:00:00.000Z',
      route: {
        distanceRemainingMeters: 3500,
        durationRemainingSeconds: 600,
        estimatedArrivalAt: '2026-06-24T14:10:00.000Z',
        encodedPolyline: 'encoded',
        coordinates: [],
      },
    } as unknown as AppointmentTrackingView;

    store.setTracking(tracking);
    store.setConnectionState('connected');
    store.setMissionEvent({
      type: 'tracking.provider.started-trip',
      reservationId: 'reservation-id',
      clientUserId: 'client-id',
      professionalId: 'professional-id',
      occurredAt: '2026-06-24T14:00:00.000Z',
    });

    expect(store.distanceRemainingMeters()).toBe(3500);
    expect(store.durationRemainingSeconds()).toBe(600);
    expect(store.isRealtimeConnected()).toBe(true);

    store.reset();

    expect(store.tracking()).toBeNull();
    expect(store.connectionState()).toBe('disconnected');
    expect(store.missionEvent()).toBeNull();
  });
});
