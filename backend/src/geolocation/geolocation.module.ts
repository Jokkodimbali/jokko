import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MapsInfrastructureModule } from '../maps/infrastructure/maps-infrastructure.module';
import { GEOCODING_PORT } from './application/ports/geocoding.port';
import { ADDRESS_AUTOCOMPLETE_PORT } from './application/ports/address-autocomplete.port';
import { AutocompleteAddressesUseCase } from './application/use-cases/autocomplete-addresses.use-case';
import { GeocodeAddressUseCase } from './application/use-cases/geocode-address.use-case';
import { ReverseGeocodeUseCase } from './application/use-cases/reverse-geocode.use-case';
import { GoogleGeocodingAdapter } from './infrastructure/google-geocoding.adapter';
import { GeoapifyGeocodingAdapter } from './infrastructure/geoapify-geocoding.adapter';
import { GoogleAddressAutocompleteAdapter } from './infrastructure/google-address-autocomplete.adapter';

@Module({
  imports: [MapsInfrastructureModule],
  providers: [
    GoogleGeocodingAdapter,
    GeoapifyGeocodingAdapter,
    GoogleAddressAutocompleteAdapter,
    {
      provide: GEOCODING_PORT,
      inject: [ConfigService, GoogleGeocodingAdapter, GeoapifyGeocodingAdapter],
      useFactory: (
        config: ConfigService,
        google: GoogleGeocodingAdapter,
        geoapify: GeoapifyGeocodingAdapter,
      ) =>
        config.get<string>('MAP_PROVIDER') === 'geoapify' ? geoapify : google,
    },
    GeocodeAddressUseCase,
    ReverseGeocodeUseCase,
    {
      provide: ADDRESS_AUTOCOMPLETE_PORT,
      inject: [
        ConfigService,
        GoogleAddressAutocompleteAdapter,
        GeoapifyGeocodingAdapter,
      ],
      useFactory: (
        config: ConfigService,
        google: GoogleAddressAutocompleteAdapter,
        geoapify: GeoapifyGeocodingAdapter,
      ) =>
        config.get<string>('MAP_PROVIDER') === 'geoapify' ? geoapify : google,
    },
    AutocompleteAddressesUseCase,
  ],
  exports: [
    GeocodeAddressUseCase,
    ReverseGeocodeUseCase,
    AutocompleteAddressesUseCase,
  ],
})
export class GeolocationModule {}
