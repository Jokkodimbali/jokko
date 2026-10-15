import { Module } from '@nestjs/common';
import { GoogleMapsApiClient } from './google/google-maps-api.client';
import { GeoapifyApiClient } from './geoapify/geoapify-api.client';

@Module({
  providers: [GoogleMapsApiClient, GeoapifyApiClient],
  exports: [GoogleMapsApiClient, GeoapifyApiClient],
})
export class MapsInfrastructureModule {}
