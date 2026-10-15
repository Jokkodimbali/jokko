import { Inject, Injectable } from '@nestjs/common';
import {
  ADDRESS_AUTOCOMPLETE_PORT,
  type AddressAutocompletePort,
} from '../ports/address-autocomplete.port';

@Injectable()
export class AutocompleteAddressesUseCase {
  constructor(
    @Inject(ADDRESS_AUTOCOMPLETE_PORT)
    private readonly addresses: AddressAutocompletePort,
  ) {}

  execute(text: string) {
    const query = text.trim();
    if (query.length < 2 || query.length > 120) return Promise.resolve([]);
    return this.addresses.autocomplete(query);
  }
}
