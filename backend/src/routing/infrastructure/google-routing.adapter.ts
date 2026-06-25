import { Injectable } from '@nestjs/common';
import { GoogleMapsApiClient } from '../../maps/infrastructure/google/google-maps-api.client';
import type {
  ComputeRoutesCommand,
  RoutingProviderPort,
} from '../application/ports/routing-provider.port';

@Injectable()
export class GoogleRoutingAdapter implements RoutingProviderPort {
  constructor(private readonly googleMapsClient: GoogleMapsApiClient) {}

  computeRoutes(command: ComputeRoutesCommand) {
    return this.googleMapsClient.computeRoutes({
      origin: command.origin,
      destination: command.destination,
      alternatives: command.alternatives ?? true,
    });
  }
}
