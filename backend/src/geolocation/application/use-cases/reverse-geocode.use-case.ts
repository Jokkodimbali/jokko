import { Inject, Injectable } from '@nestjs/common';
import { appHttpException } from '../../../core/http/app-http.exception';
import { GeoCoordinate } from '../../../maps/domain/value-objects/geo-coordinate.value-object';
import { GEOCODING_PORT, type GeocodingPort } from '../ports/geocoding.port';

@Injectable()
export class ReverseGeocodeUseCase {
  constructor(
    @Inject(GEOCODING_PORT)
    private readonly geocoding: GeocodingPort,
  ) {}

  execute(input: { latitude: number; longitude: number }) {
    try {
      return this.geocoding.reverseGeocode(
        GeoCoordinate.create(input).toValue(),
      );
    } catch {
      throw appHttpException('MAPS_COORDINATES_INVALID');
    }
  }
}
