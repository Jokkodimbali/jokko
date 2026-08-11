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

  it('rejects an older position and preserves the newest coordinates', () => {
    const store = new TrackingStore();
    const recent = trackingAt('2026-06-24T14:00:02.000Z', 14.72, { encodedPolyline: 'recent' });
    const old = trackingAt('2026-06-24T14:00:01.000Z', 14.7, null);

    expect(store.setTracking(recent)).toBe(true);
    expect(store.setTracking(old)).toBe(false);

    expect(store.tracking()?.lastLatitude).toBe(14.72);
    expect(store.tracking()?.route?.encodedPolyline).toBe('recent');
  });

  it('merges equal-timestamp enrichment without deleting an existing route', () => {
    const store = new TrackingStore();
    store.setTracking(trackingAt('2026-06-24T14:00:02.000Z', 14.72, { encodedPolyline: 'route' }));

    store.setTracking(trackingAt('2026-06-24T14:00:02.000Z', 14.72, null));

    expect(store.tracking()?.route?.encodedPolyline).toBe('route');
  });
});

function trackingAt(
  lastPositionAt: string,
  lastLatitude: number,
  route: { encodedPolyline: string } | null,
): AppointmentTrackingView {
  return {
    reservationId: 'reservation-id',
    lastPositionAt,
    lastLatitude,
    route,
    presence: { lastPositionAt },
  } as unknown as AppointmentTrackingView;
}
