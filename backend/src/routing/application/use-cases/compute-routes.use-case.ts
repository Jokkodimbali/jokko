import { Inject, Injectable } from '@nestjs/common';
import { appHttpException } from '../../../core/http/app-http.exception';
import { GeoCoordinate } from '../../../maps/domain/value-objects/geo-coordinate.value-object';
import {
  ROUTING_PROVIDER_PORT,
  type RoutingProviderPort,
} from '../ports/routing-provider.port';

@Injectable()
export class ComputeRoutesUseCase {
  constructor(
    @Inject(ROUTING_PROVIDER_PORT)
    private readonly routingProvider: RoutingProviderPort,
  ) {}

  execute(input: {
    origin: { latitude: number; longitude: number };
    destination: { latitude: number; longitude: number };
    alternatives?: boolean;
  }) {
    try {
      return this.routingProvider.computeRoutes({
        origin: GeoCoordinate.create(input.origin).toValue(),
        destination: GeoCoordinate.create(input.destination).toValue(),
        alternatives: input.alternatives ?? true,
      });
    } catch (error) {
      if (
        error instanceof Error &&
        error.message === 'INVALID_GEO_COORDINATE'
      ) {
        throw appHttpException('MAPS_COORDINATES_INVALID');
      }
      throw error;
    }
  }
}
