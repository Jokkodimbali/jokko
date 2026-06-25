import type { GeocodedAddress } from '../../../maps/domain/models/map-route.model';
import type { GeoCoordinateValue } from '../../../maps/domain/value-objects/geo-coordinate.value-object';

export const GEOCODING_PORT = Symbol('GEOCODING_PORT');

export interface GeocodingPort {
  geocode(address: string): Promise<GeocodedAddress | null>;
  reverseGeocode(
    coordinate: GeoCoordinateValue,
  ): Promise<GeocodedAddress | null>;
}
