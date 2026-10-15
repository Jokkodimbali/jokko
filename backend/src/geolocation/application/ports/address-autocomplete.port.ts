import type { GeocodedAddress } from '../../../maps/domain/models/map-route.model';

export const ADDRESS_AUTOCOMPLETE_PORT = Symbol('ADDRESS_AUTOCOMPLETE_PORT');

export interface AddressAutocompletePort {
  autocomplete(text: string): Promise<GeocodedAddress[]>;
}
