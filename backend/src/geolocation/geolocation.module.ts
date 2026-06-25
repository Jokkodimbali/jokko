import { Module } from '@nestjs/common';
import { MapsInfrastructureModule } from '../maps/infrastructure/maps-infrastructure.module';
import { GEOCODING_PORT } from './application/ports/geocoding.port';
import { GeocodeAddressUseCase } from './application/use-cases/geocode-address.use-case';
import { ReverseGeocodeUseCase } from './application/use-cases/reverse-geocode.use-case';
import { GoogleGeocodingAdapter } from './infrastructure/google-geocoding.adapter';

@Module({
  imports: [MapsInfrastructureModule],
  providers: [
    GoogleGeocodingAdapter,
    { provide: GEOCODING_PORT, useExisting: GoogleGeocodingAdapter },
    GeocodeAddressUseCase,
    ReverseGeocodeUseCase,
  ],
  exports: [GeocodeAddressUseCase, ReverseGeocodeUseCase],
})
export class GeolocationModule {}
