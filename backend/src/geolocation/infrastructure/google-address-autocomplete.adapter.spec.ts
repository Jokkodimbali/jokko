import { GoogleAddressAutocompleteAdapter } from './google-address-autocomplete.adapter';
import { type GoogleMapsApiClient } from '../../maps/infrastructure/google/google-maps-api.client';

describe('GoogleAddressAutocompleteAdapter', () => {
  it('uses Google only and returns its resolved address when selected', async () => {
    const result = {
      latitude: 14.7,
      longitude: -17.4,
      formattedAddress: 'Dakar, Sénégal',
      placeId: 'google-place',
    };
    const geocodeAddress = jest.fn().mockResolvedValue(result);
    const adapter = new GoogleAddressAutocompleteAdapter({
      geocodeAddress,
    } as unknown as GoogleMapsApiClient);
    await expect(adapter.autocomplete('Dakar')).resolves.toEqual([result]);
    expect(geocodeAddress).toHaveBeenCalledWith('Dakar');
  });
});
