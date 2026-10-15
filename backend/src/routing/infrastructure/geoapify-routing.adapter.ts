import { Injectable } from '@nestjs/common';
import type {
  ComputeRoutesCommand,
  RoutingProviderPort,
} from '../application/ports/routing-provider.port';
import { GeoapifyApiClient } from '../../maps/infrastructure/geoapify/geoapify-api.client';

@Injectable()
export class GeoapifyRoutingAdapter implements RoutingProviderPort {
  constructor(private readonly client: GeoapifyApiClient) {}
  computeRoutes(command: ComputeRoutesCommand) {
    return this.client.computeRoutes({
      ...command,
      alternatives: command.alternatives ?? true,
    });
  }
}
