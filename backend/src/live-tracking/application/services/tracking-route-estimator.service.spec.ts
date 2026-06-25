import type { GeocodeAddressUseCase } from '../../../geolocation/application/use-cases/geocode-address.use-case';
import type { ComputeRoutesUseCase } from '../../../routing/application/use-cases/compute-routes.use-case';
import type { ReservationTrackingView } from '../ports/live-tracking-repository.port';
import { TrackingRouteEstimatorService } from './tracking-route-estimator.service';

describe('TrackingRouteEstimatorService', () => {
  const tracking: ReservationTrackingView = {
    reservationId: 'reservation-id',
    clientUserId: 'client-id',
    professionalId: 'professional-id',
    professionalUserId: 'professional-user-id',
    trackingStatus: 'EN_ROUTE',
    startedAt: new Date(),
    endedAt: null,
    lastLatitude: 14.7167,
    lastLongitude: -17.4677,
    lastAccuracyMeters: 8,
    lastHeadingDegrees: 120,
    lastSpeedKmh: 25,
    lastLocationLabel: 'Dakar',
    lastPositionAt: new Date(),
    updatedAt: new Date(),
    presence: {
      professionalId: 'professional-id',
      isOnline: true,
      status: 'EN_ROUTE',
      lastLatitude: 14.7167,
      lastLongitude: -17.4677,
      lastAccuracyMeters: 8,
      lastHeadingDegrees: 120,
      lastSpeedKmh: 25,
      lastLocationLabel: 'Dakar',
      lastPositionAt: new Date(),
      lastSeenAt: new Date(),
      updatedAt: new Date(),
    },
  };

  it('enriches tracking with distance, duration, ETA and polyline', async () => {
    const geocode = {
      execute: jest.fn().mockResolvedValue({
        latitude: 14.6937,
        longitude: -17.4441,
        formattedAddress: 'Dakar Plateau',
        placeId: 'place-id',
      }),
    } as unknown as jest.Mocked<GeocodeAddressUseCase>;
    const routes = {
      execute: jest.fn().mockResolvedValue([
        {
          id: 'route-0',
          distanceMeters: 4200,
          durationSeconds: 720,
          encodedPolyline: 'encoded',
          coordinates: [
            { latitude: 14.7167, longitude: -17.4677 },
            { latitude: 14.6937, longitude: -17.4441 },
          ],
        },
      ]),
    } as unknown as jest.Mocked<ComputeRoutesUseCase>;
    const service = new TrackingRouteEstimatorService(geocode, routes);

    const result = await service.enrich(tracking, 'Dakar Plateau');

    expect(result.route).toMatchObject({
      distanceRemainingMeters: 4200,
      durationRemainingSeconds: 720,
      encodedPolyline: 'encoded',
    });
    expect(result.route?.estimatedArrivalAt).toBeTruthy();
  });

  it('reuses a recent estimate for the same rounded position', async () => {
    const geocode = {
      execute: jest.fn().mockResolvedValue({
        latitude: 14.6937,
        longitude: -17.4441,
      }),
    } as unknown as jest.Mocked<GeocodeAddressUseCase>;
    const routes = {
      execute: jest.fn().mockResolvedValue([]),
    } as unknown as jest.Mocked<ComputeRoutesUseCase>;
    const service = new TrackingRouteEstimatorService(geocode, routes);

    await service.enrich(tracking, 'Dakar Plateau');
    await service.enrich(
      { ...tracking, lastLatitude: 14.71671 },
      'Dakar Plateau',
    );

    expect(geocode.execute).toHaveBeenCalledTimes(1);
    expect(routes.execute).toHaveBeenCalledTimes(1);
  });
});
