import { LiveTrackingCommandService } from './live-tracking-command.service';
import type { ReservationTrackingView } from '../ports/live-tracking-repository.port';

describe('LiveTrackingCommandService realtime payload contracts', () => {
  const emit = jest.fn();
  const service = new LiveTrackingCommandService(
    {} as never,
    {} as never,
    {} as never,
    { emit } as never,
    {} as never,
    {} as never,
  );
  const internals = service as unknown as {
    publishLocationRealtime(tracking: ReservationTrackingView): void;
    publishRouteMetadataRealtime(tracking: ReservationTrackingView): void;
  };

  beforeEach(() => emit.mockClear());

  it('publishes location data without route metadata or a full snapshot', () => {
    internals.publishLocationRealtime(trackingView());

    expect(emit).toHaveBeenCalledWith('live-tracking.location.updated', {
      reservationId: 'reservation',
      clientUserId: 'client',
      professionalId: 'professional',
      latitude: 14.72,
      longitude: -17.46,
      accuracyMeters: 8,
      headingDegrees: 90,
      speedKmh: 36,
      positionTimestamp: '2026-08-13T10:00:00.000Z',
    });
    expect(emit.mock.calls[0][1]).not.toHaveProperty('route');
    expect(emit.mock.calls[0][1]).not.toHaveProperty('presence');
  });

  it('publishes route metadata without replaying GPS fields', () => {
    internals.publishRouteMetadataRealtime(trackingView());

    const payload = emit.mock.calls[0][1];
    expect(emit.mock.calls[0][0]).toBe('live-tracking.route-metadata.updated');
    expect(payload.positionTimestamp).toBe('2026-08-13T10:00:00.000Z');
    expect(payload.route.distanceRemainingMeters).toBe(1_000);
    expect(payload).not.toHaveProperty('latitude');
    expect(payload).not.toHaveProperty('longitude');
  });
});

function trackingView(): ReservationTrackingView {
  return {
    reservationId: 'reservation',
    clientUserId: 'client',
    professionalId: 'professional',
    professionalUserId: 'professional-user',
    trackingStatus: 'EN_ROUTE',
    startedAt: new Date('2026-08-13T09:55:00.000Z'),
    endedAt: null,
    lastLatitude: 14.72,
    lastLongitude: -17.46,
    lastAccuracyMeters: 8,
    lastHeadingDegrees: 90,
    lastSpeedKmh: 36,
    lastLocationLabel: null,
    lastPositionAt: new Date('2026-08-13T10:00:00.000Z'),
    updatedAt: new Date('2026-08-13T10:00:00.000Z'),
    presence: { professionalId: 'professional' } as never,
    route: {
      distanceRemainingMeters: 1_000,
      durationRemainingSeconds: 120,
      estimatedArrivalAt: '2026-08-13T10:02:00.000Z',
      positionTimestamp: '2026-08-13T10:00:00.000Z',
      encodedPolyline: 'encoded',
      coordinates: [
        { latitude: 14.72, longitude: -17.46 },
        { latitude: 14.73, longitude: -17.45 },
      ],
    },
  };
}
