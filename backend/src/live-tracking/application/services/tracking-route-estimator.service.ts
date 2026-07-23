import { Injectable } from '@nestjs/common';
import { GeocodeAddressUseCase } from '../../../geolocation/application/use-cases/geocode-address.use-case';
import { ComputeRoutesUseCase } from '../../../routing/application/use-cases/compute-routes.use-case';
import type { ReservationTrackingView } from '../ports/live-tracking-repository.port';

const ROUTE_CACHE_TTL_MS = 5_000;

@Injectable()
export class TrackingRouteEstimatorService {
  private readonly routeCache = new Map<
    string,
    {
      expiresAt: number;
      value: Promise<ReservationTrackingView['route']>;
    }
  >();

  constructor(
    private readonly geocodeAddress: GeocodeAddressUseCase,
    private readonly computeRoutes: ComputeRoutesUseCase,
  ) {}

  async enrich(
    tracking: ReservationTrackingView,
    destinationAddress: string,
  ): Promise<ReservationTrackingView> {
    if (
      typeof tracking.lastLatitude !== 'number' ||
      typeof tracking.lastLongitude !== 'number' ||
      tracking.trackingStatus !== 'EN_ROUTE'
    ) {
      return { ...tracking, route: null };
    }

    const cacheKey = this.cacheKey(
      tracking.lastLatitude,
      tracking.lastLongitude,
      destinationAddress,
    );
    const cached = this.routeCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return { ...tracking, route: await cached.value };
    }

    const routePromise = this.estimateRoute(
      tracking.lastLatitude,
      tracking.lastLongitude,
      destinationAddress,
    );
    this.routeCache.set(cacheKey, {
      expiresAt: Date.now() + ROUTE_CACHE_TTL_MS,
      value: routePromise,
    });
    const route = await routePromise;
    this.pruneExpiredEntries();
    return { ...tracking, route };
  }

  private async estimateRoute(
    latitude: number,
    longitude: number,
    destinationAddress: string,
  ): Promise<ReservationTrackingView['route']> {
    try {
      const destination = await this.geocodeAddress.execute(destinationAddress);
      if (!destination) return null;

      const routes = await this.computeRoutes.execute({
        origin: { latitude, longitude },
        destination,
        alternatives: false,
      });
      const route = routes[0];
      if (!route) return null;

      return {
        distanceRemainingMeters: route.distanceMeters,
        durationRemainingSeconds: route.durationSeconds,
        estimatedArrivalAt: new Date(
          Date.now() + route.durationSeconds * 1000,
        ).toISOString(),
        encodedPolyline: route.encodedPolyline,
        coordinates: route.coordinates,
        navigationSteps: route.navigationSteps,
      };
    } catch {
      return null;
    }
  }

  private cacheKey(
    latitude: number,
    longitude: number,
    destinationAddress: string,
  ): string {
    return [
      latitude.toFixed(5),
      longitude.toFixed(5),
      destinationAddress.trim().toLocaleLowerCase('fr'),
    ].join('|');
  }

  private pruneExpiredEntries(): void {
    if (this.routeCache.size < 100) return;

    const now = Date.now();
    this.routeCache.forEach((entry, key) => {
      if (entry.expiresAt <= now) {
        this.routeCache.delete(key);
      }
    });
  }
}
