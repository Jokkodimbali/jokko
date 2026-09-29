import { LiveTrackingGateway } from './live-tracking.gateway';

describe('LiveTrackingGateway route synchronization', () => {
  it('broadcasts a selected route only after the actor selection is persisted', async () => {
    const emit = jest.fn();
    const to = jest.fn().mockReturnValue({ emit });
    const selectRoute = jest.fn().mockResolvedValue(true);
    const gateway = new LiveTrackingGateway(
      {} as never,
      {} as never,
      { selectRoute } as never,
      {} as never,
    );
    gateway.server = { to } as never;
    const client = { id: 'socket-1' } as never;
    (gateway as unknown).socketUsers.set('socket-1', { sub: 'actor-1' });
    const selection = {
      reservationId: 'reservation-1',
      sessionStartedAt: '2026-09-28T10:00:00.000Z',
      routeId: 'route-1',
      coordinates: [
        { lat: 14.7, lng: -17.4 },
        { lat: 14.8, lng: -17.3 },
      ],
      distanceKm: 10,
      durationMinutes: 15,
      navigationSteps: [],
      selectedAt: '2026-09-28T10:01:00.000Z',
    };
    await gateway.handleRouteSelection(client, selection);
    expect(selectRoute).toHaveBeenCalledWith(
      expect.objectContaining({ sub: 'actor-1' }),
      selection,
    );
    expect(emit).toHaveBeenCalledWith('tracking.route.selected', selection);
    selectRoute.mockResolvedValue(false);
    emit.mockClear();
    await gateway.handleRouteSelection(client, selection);
    expect(emit).not.toHaveBeenCalled();
  });

  it('broadcasts the resumed delivery session before its route is calculated', () => {
    const emit = jest.fn();
    const to = jest.fn().mockReturnValue({ emit });
    const gateway = new LiveTrackingGateway(
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );
    gateway.server = { to } as never;
    const tracking = {
      reservationId: 'reservation-1',
      clientUserId: 'client-1',
      professionalId: 'courier-1',
      trackingStatus: 'EN_ROUTE',
      startedAt: new Date('2026-09-28T10:00:00.000Z'),
      route: null,
    } as never;

    gateway.handleTrackingSessionResumed(tracking);

    expect(to).toHaveBeenCalledTimes(3);
    expect(emit).toHaveBeenCalledTimes(3);
    expect(emit).toHaveBeenCalledWith('tracking.snapshot', tracking);
  });

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
    expect(emit).toHaveBeenNthCalledWith(
      3,
      'tracking.route-metadata.updated',
      payload,
    );
  });

  it('sends an arrival snapshot to the reservation, client and professional', async () => {
    const emit = jest.fn();
    const to = jest.fn().mockReturnValue({ emit });
    const tracking = {
      reservationId: 'reservation-1',
      clientUserId: 'client-1',
      professionalId: 'professional-1',
      trackingStatus: 'TERMINEE',
    };
    const gateway = new LiveTrackingGateway(
      {} as never,
      {} as never,
      {
        getReservationTracking: jest.fn().mockResolvedValue(tracking),
      } as never,
      {} as never,
    );
    gateway.server = { to } as never;

    await gateway.handleMissionStatusUpdated({
      nom: 'tracking.provider.arrived',
      payload: {
        reservationId: 'reservation-1',
        clientUserId: 'client-1',
        professionalId: 'professional-1',
      },
      dateOccurrence: new Date('2026-09-17T10:00:00.000Z'),
    });

    expect(to).toHaveBeenNthCalledWith(1, 'tracking:reservation:reservation-1');
    expect(to).toHaveBeenNthCalledWith(2, 'user:client-1');
    expect(to).toHaveBeenNthCalledWith(
      3,
      'tracking:professional:professional-1',
    );
    expect(emit).toHaveBeenCalledTimes(3);
    expect(emit).toHaveBeenNthCalledWith(
      3,
      'tracking.mission.updated',
      expect.objectContaining({
        type: 'tracking.provider.arrived',
        tracking,
      }),
    );
  });
});
