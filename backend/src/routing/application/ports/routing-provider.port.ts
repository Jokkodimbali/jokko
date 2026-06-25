import type { MapRoute } from '../../../maps/domain/models/map-route.model';
import type { GeoCoordinateValue } from '../../../maps/domain/value-objects/geo-coordinate.value-object';

export const ROUTING_PROVIDER_PORT = Symbol('ROUTING_PROVIDER_PORT');

export type ComputeRoutesCommand = {
  origin: GeoCoordinateValue;
  destination: GeoCoordinateValue;
  alternatives?: boolean;
};

export interface RoutingProviderPort {
  computeRoutes(command: ComputeRoutesCommand): Promise<MapRoute[]>;
}
