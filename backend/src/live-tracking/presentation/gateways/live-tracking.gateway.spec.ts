import { LiveTrackingGateway } from './live-tracking.gateway';

describe('LiveTrackingGateway route synchronization', () => {
  it('sends the recalculated route to the reservation, client and courier', () => {
    const emit = jest.fn();
    const to = jest.fn().mockReturnValue({ emit });
    const gateway = new LiveTrackingGateway(
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );
    gateway.server = { to } as never;
    const payload = {
      reservationId: 'reservation-1',
      clientUserId: 'client-1',
      professionalId: 'courier-1',
      positionTimestamp: '2026-09-16T15:00:00.000Z',
      route: {
        distanceRemainingMeters: 1200,
        durationRemainingSeconds: 180,
        estimatedArrivalAt: '2026-09-16T15:03:00.000Z',
        positionTimestamp: '2026-09-16T15:00:00.000Z',
        encodedPolyline: 'dropoff-route',
        coordinates: [],
      },
    };

    gateway.handleTrackingRouteMetadataUpdate(payload);

    expect(to).toHaveBeenNthCalledWith(1, 'tracking:reservation:reservation-1');
    expect(to).toHaveBeenNthCalledWith(2, 'user:client-1');
    expect(to).toHaveBeenNthCalledWith(3, 'tracking:professional:courier-1');
    expect(emit).toHaveBeenCalledTimes(3);
    expect(emit).toHaveBeenNthCalledWith(3, 'tracking.route-metadata.updated', payload);
  });
});
