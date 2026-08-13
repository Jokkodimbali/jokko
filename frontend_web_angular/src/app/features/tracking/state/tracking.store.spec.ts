import type { AppointmentTrackingView } from '../../appointments/domain/appointments.models';
import { TrackingStore } from './tracking.store';

describe('TrackingStore - ordering and session contracts', () => {
  it('exposes route metrics and resets every realtime value', () => {
    const store = new TrackingStore();
    const tracking = trackingAt('2026-08-13T10:00:00.000Z', 14.72, 'route');
    tracking.route = {
      ...tracking.route,
      distanceRemainingMeters: 3_500,
      durationRemainingSeconds: 600,
    } as AppointmentTrackingView['route'];
    store.setTracking(tracking);
    store.setConnectionState('connected');
    store.setMissionEvent({
      type: 'tracking.provider.started-trip',
      reservationId: 'reservation',
      clientUserId: 'client',
      professionalId: 'professional',
      occurredAt: '2026-08-13T10:00:00.000Z',
    });

    expect(store.distanceRemainingMeters()).toBe(3_500);
    expect(store.durationRemainingSeconds()).toBe(600);
    expect(store.isRealtimeConnected()).toBe(true);
    store.reset();
    expect(store.tracking()).toBeNull();
    expect(store.connectionState()).toBe('disconnected');
    expect(store.missionEvent()).toBeNull();
  });

  it('rejects every position older than the latest accepted sample', () => {
    const store = new TrackingStore();
    expect(store.setTracking(trackingAt('2026-08-13T10:00:02.000Z', 14.72, 'new'))).toBe(true);
    expect(store.setTracking(trackingAt('2026-08-13T10:00:01.000Z', 14.7, 'old'))).toBe(false);
    expect(store.tracking()?.lastLatitude).toBe(14.72);
    expect(store.tracking()?.route?.encodedPolyline).toBe('new');
  });

  it('keeps route enrichment when an equal-timestamp event has no route', () => {
    const store = new TrackingStore();
    store.setTracking(trackingAt('2026-08-13T10:00:02.000Z', 14.72, 'route'));
    store.setTracking(trackingAt('2026-08-13T10:00:02.000Z', 14.72, null));
    expect(store.tracking()?.route?.encodedPolyline).toBe('route');
  });

  it('accepts a newer EN_ROUTE session even if its first GPS timestamp is slightly older', () => {
    const store = new TrackingStore();
    const oldArrival = trackingAt('2026-08-13T10:05:00.000Z', 14.72, null);
    oldArrival.trackingStatus = 'TERMINEE';
    oldArrival.startedAt = '2026-08-13T09:30:00.000Z';
    const newTrip = trackingAt('2026-08-13T10:04:59.000Z', 14.73, null);
    newTrip.trackingStatus = 'EN_ROUTE';
    newTrip.startedAt = '2026-08-13T10:04:58.000Z';

    expect(store.setTracking(oldArrival)).toBe(true);
    expect(store.setTracking(newTrip)).toBe(true);
    expect(store.tracking()?.trackingStatus).toBe('EN_ROUTE');
  });

  it('rejects a late terminal event from a previous parcel leg', () => {
    const store = new TrackingStore();
    const dropoff = trackingAt('2026-08-13T10:05:00.000Z', 14.73, null);
    dropoff.trackingStatus = 'EN_ROUTE';
    dropoff.startedAt = '2026-08-13T10:05:00.000Z';
    const latePickup = trackingAt('2026-08-13T10:05:00.000Z', 14.72, null);
    latePickup.trackingStatus = 'TERMINEE';
    latePickup.startedAt = '2026-08-13T09:30:00.000Z';

    store.setTracking(dropoff);
    expect(store.setTracking(latePickup)).toBe(false);
    expect(store.tracking()?.lastLatitude).toBe(14.73);
  });
});

function trackingAt(
  lastPositionAt: string,
  latitude: number,
  encodedPolyline: string | null,
): AppointmentTrackingView {
  return {
    reservationId: 'reservation',
    lastPositionAt,
    lastLatitude: latitude,
    route: encodedPolyline ? { encodedPolyline } : null,
    presence: { lastPositionAt },
  } as unknown as AppointmentTrackingView;
}
