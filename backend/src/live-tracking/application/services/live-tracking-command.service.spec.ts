import { LiveTrackingCommandService } from './live-tracking-command.service';
import type { ReservationTrackingView } from '../ports/live-tracking-repository.port';
import { LiveTrackingDomainError } from '../../domain/errors/live-tracking.domain-error';

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

  it('notifie le professionnel lorsque le client commence son trajet', async () => {
    const tracking = trackingView();
    const repository = {
      findReservationContext: jest.fn().mockResolvedValue({
        reservationId: 'reservation',
        clientUserId: 'client',
        professionalId: 'professional',
        professionalUserId: 'professional-user',
        reservationStatus: 'PAYEE_SEQUESTRE',
        travelMode: 'CLIENT_SE_DEPLACE',
        serviceName: 'Consultation',
      }),
      startOrResumeTravelerTracking: jest.fn().mockResolvedValue(tracking),
    };
    const notifications = {
      notifyTripStatus: jest.fn().mockResolvedValue(undefined),
    };
    const clientTravelService = new LiveTrackingCommandService(
      repository as never,
      {} as never,
      {} as never,
      { emit: jest.fn() } as never,
      notifications as never,
      { enrich: jest.fn().mockResolvedValue(tracking) } as never,
    );

    await clientTravelService.markOnTheWay(
      { sub: 'client' } as never,
      'reservation',
      { latitude: 14.72, longitude: -17.46 } as never,
    );

    expect(repository.startOrResumeTravelerTracking).toHaveBeenCalledTimes(1);
    expect(notifications.notifyTripStatus).toHaveBeenCalledWith({
      reservationId: 'reservation',
      recipientUserId: 'professional-user',
      serviceName: 'Consultation',
      travellerRole: 'CLIENT',
      tripStatus: 'EN_ROUTE',
    });
    expect(notifications.notifyTripStatus).toHaveBeenCalledWith({
      reservationId: 'reservation',
      recipientUserId: 'client',
      serviceName: 'Consultation',
      travellerRole: 'CLIENT',
      recipientIsTraveller: true,
      tripStatus: 'EN_ROUTE',
    });
  });

  it('refuse un second trajet actif pour le meme professionnel', async () => {
    const repository = {
      findReservationContext: jest.fn().mockResolvedValue({
        reservationId: 'reservation-2',
        clientUserId: 'client',
        professionalId: 'professional',
        professionalUserId: 'professional-user',
        reservationStatus: 'PAYEE_SEQUESTRE',
        travelMode: 'PRESTATAIRE_SE_DEPLACE',
        serviceName: 'Reparation',
      }),
      findProfessionalPresence: jest.fn().mockResolvedValue(null),
      startOrResumeTracking: jest
        .fn()
        .mockRejectedValue(LiveTrackingDomainError.anotherTripActive()),
    };
    const service = new LiveTrackingCommandService(
      repository as never,
      { findByUserId: jest.fn().mockResolvedValue({ id: 'professional' }) } as never,
      {} as never,
      { emit: jest.fn() } as never,
      {} as never,
      {} as never,
    );

    await expect(
      service.markOnTheWay(
        { sub: 'professional-user', role: 'PRESTATAIRE' } as never,
        'reservation-2',
        { latitude: 14.72, longitude: -17.46 } as never,
      ),
    ).rejects.toMatchObject({ code: 'LIVE_TRACKING_ANOTHER_TRIP_ACTIVE' });
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
