import { Injectable } from '@nestjs/common';
import type { GeocodingPort } from '../application/ports/geocoding.port';
import { GoogleMapsApiClient } from '../../maps/infrastructure/google/google-maps-api.client';

@Injectable()
export class GoogleGeocodingAdapter implements GeocodingPort {
  constructor(private readonly googleMapsClient: GoogleMapsApiClient) {}

  geocode(address: string) {
    return this.googleMapsClient.geocodeAddress(address);
  }

  reverseGeocode(coordinate: { latitude: number; longitude: number }) {
    return this.googleMapsClient.reverseGeocode(coordinate);
  }
}
