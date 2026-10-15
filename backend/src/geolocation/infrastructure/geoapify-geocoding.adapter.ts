import { Injectable } from '@nestjs/common';
import type { GeocodingPort } from '../application/ports/geocoding.port';
import { GeoapifyApiClient } from '../../maps/infrastructure/geoapify/geoapify-api.client';

@Injectable()
export class GeoapifyGeocodingAdapter implements GeocodingPort {
  constructor(private readonly client: GeoapifyApiClient) {}

  geocode(address: string) {
    return this.client.geocodeAddress(address);
  }
  autocomplete(text: string) {
    return this.client.autocomplete(text);
  }
  reverseGeocode(coordinate: { latitude: number; longitude: number }) {
    return this.client.reverseGeocode(coordinate);
  }
}
