import { Inject, Injectable } from '@nestjs/common';
import { appHttpException } from '../../../core/http/app-http.exception';
import { GEOCODING_PORT, type GeocodingPort } from '../ports/geocoding.port';

@Injectable()
export class GeocodeAddressUseCase {
  constructor(
    @Inject(GEOCODING_PORT)
    private readonly geocoding: GeocodingPort,
  ) {}

  execute(address: string) {
    const normalizedAddress = address.trim();
    if (!normalizedAddress) {
      throw appHttpException('MAPS_ADDRESS_INVALID');
    }

    return this.geocoding.geocode(normalizedAddress);
  }
}
