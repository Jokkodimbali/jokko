import { Injectable } from '@nestjs/common';
import type { AddressAutocompletePort } from '../application/ports/address-autocomplete.port';
import { GoogleMapsApiClient } from '../../maps/infrastructure/google/google-maps-api.client';

/** Google suggestions are handled by Places in the browser. Keep the shared
 * HTTP endpoint usable without making Google depend on a Geoapify key. */
@Injectable()
export class GoogleAddressAutocompleteAdapter implements AddressAutocompletePort {
  constructor(private readonly client: GoogleMapsApiClient) {}

  async autocomplete(text: string) {
    const result = await this.client.geocodeAddress(text);
    return result ? [result] : [];
  }
}
