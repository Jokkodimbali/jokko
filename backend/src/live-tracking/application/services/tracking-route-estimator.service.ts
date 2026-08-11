import { Injectable } from '@nestjs/common';
import { GeocodeAddressUseCase } from '../../../geolocation/application/use-cases/geocode-address.use-case';
import { ComputeRoutesUseCase } from '../../../routing/application/use-cases/compute-routes.use-case';
import type { ReservationTrackingView } from '../ports/live-tracking-repository.port';

const ROUTE_RECOMPUTE_MIN_INTERVAL_MS = 4_000;
const ROUTE_RECOMPUTE_MIN_DISTANCE_METERS = 40;

@Injectable()
export class TrackingRouteEstimatorService {
  private readonly recentRouteByJourney = new Map<
    string,
    {
      at: number;
      latitude: number;
      longitude: number;
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

    const journeyKey = this.journeyKey(
      tracking.reservationId,
      destinationAddress,
    );
    const recent = this.recentRouteByJourney.get(journeyKey);
    if (
      recent &&
      !this.shouldRecomputeRoute(
        recent,
        tracking.lastLatitude,
        tracking.lastLongitude,
      )
    ) {
      return { ...tracking, route: await recent.value };
    }

    const routePromise = this.estimateRoute(
      tracking.lastLatitude,
      tracking.lastLongitude,
      destinationAddress,
    );
    this.recentRouteByJourney.set(journeyKey, {
      at: Date.now(),
      latitude: tracking.lastLatitude,
      longitude: tracking.lastLongitude,
      value: routePromise,
    });
    const route = await routePromise;
    this.pruneRecentRoutes();
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

  private journeyKey(
    reservationId: string,
    destinationAddress: string,
  ): string {
    return `${reservationId}|${destinationAddress.trim().toLocaleLowerCase('fr')}`;
  }

  private shouldRecomputeRoute(
    previous: { at: number; latitude: number; longitude: number },
    latitude: number,
    longitude: number,
  ): boolean {
    const elapsedMs = Date.now() - previous.at;
    if (elapsedMs >= ROUTE_RECOMPUTE_MIN_INTERVAL_MS) return true;
    return (
      this.haversineDistanceMeters(
        previous.latitude,
        previous.longitude,
        latitude,
        longitude,
      ) >= ROUTE_RECOMPUTE_MIN_DISTANCE_METERS
    );
  }

  private haversineDistanceMeters(
    fromLatitude: number,
    fromLongitude: number,
    toLatitude: number,
    toLongitude: number,
  ): number {
    const earthRadiusMeters = 6_371_000;
    const latitudeDelta = ((toLatitude - fromLatitude) * Math.PI) / 180;
    const longitudeDelta = ((toLongitude - fromLongitude) * Math.PI) / 180;
    const fromLatitudeRadians = (fromLatitude * Math.PI) / 180;
    const toLatitudeRadians = (toLatitude * Math.PI) / 180;
    const haversine =
      Math.sin(latitudeDelta / 2) ** 2 +
      Math.cos(fromLatitudeRadians) *
        Math.cos(toLatitudeRadians) *
        Math.sin(longitudeDelta / 2) ** 2;
    return (
      earthRadiusMeters *
      2 *
      Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine))
    );
  }

  private pruneRecentRoutes(): void {
    if (this.recentRouteByJourney.size < 500) return;
    const journeyCutoff = Date.now() - ROUTE_RECOMPUTE_MIN_INTERVAL_MS * 3;
    this.recentRouteByJourney.forEach((entry, key) => {
      if (entry.at < journeyCutoff) this.recentRouteByJourney.delete(key);
    });
  }
}
