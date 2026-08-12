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

  it('accepts a newer EN_ROUTE session even when the previous arrival has a newer GPS timestamp', () => {
    const store = new TrackingStore();
    const previousArrival = trackingAt('2026-06-24T14:05:00.000Z', 14.72, null);
    previousArrival.trackingStatus = 'TERMINEE';
    previousArrival.startedAt = '2026-06-24T13:30:00.000Z';

    const newTrip = trackingAt('2026-06-24T14:04:59.000Z', 14.73, null);
    newTrip.trackingStatus = 'EN_ROUTE';
    newTrip.startedAt = '2026-06-24T14:04:58.000Z';

    expect(store.setTracking(previousArrival)).toBe(true);
    expect(store.setTracking(newTrip)).toBe(true);
    expect(store.tracking()?.trackingStatus).toBe('EN_ROUTE');
    expect(store.tracking()?.lastLatitude).toBe(14.73);
  });

  it('rejects a late terminal event from the pickup route after dropoff navigation starts', () => {
    const store = new TrackingStore();
    const dropoffTrip = trackingAt('2026-06-24T14:05:00.000Z', 14.73, null);
    dropoffTrip.trackingStatus = 'EN_ROUTE';
    dropoffTrip.startedAt = '2026-06-24T14:05:00.000Z';

    const latePickupArrival = trackingAt('2026-06-24T14:05:00.000Z', 14.72, null);
    latePickupArrival.trackingStatus = 'TERMINEE';
    latePickupArrival.startedAt = '2026-06-24T13:30:00.000Z';

    expect(store.setTracking(dropoffTrip)).toBe(true);
    expect(store.setTracking(latePickupArrival)).toBe(false);
    expect(store.tracking()?.trackingStatus).toBe('EN_ROUTE');
    expect(store.tracking()?.lastLatitude).toBe(14.73);
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
