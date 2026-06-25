import { Module } from '@nestjs/common';
import { GoogleMapsApiClient } from './google/google-maps-api.client';

@Module({
  providers: [GoogleMapsApiClient],
  exports: [GoogleMapsApiClient],
})
export class MapsInfrastructureModule {}
