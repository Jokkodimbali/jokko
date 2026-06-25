export type GeoCoordinateValue = {
  latitude: number;
  longitude: number;
};

const SENEGAL_BOUNDS = {
  minLatitude: 12,
  maxLatitude: 17.2,
  minLongitude: -18.7,
  maxLongitude: -11,
} as const;

export class GeoCoordinate {
  private constructor(
    readonly latitude: number,
    readonly longitude: number,
  ) {}

  static create(value: GeoCoordinateValue): GeoCoordinate {
    if (!GeoCoordinate.isValid(value)) {
      throw new Error('INVALID_GEO_COORDINATE');
    }

    return new GeoCoordinate(value.latitude, value.longitude);
  }

  static isValid(value: GeoCoordinateValue): boolean {
    return (
      Number.isFinite(value.latitude) &&
      Number.isFinite(value.longitude) &&
      value.latitude >= SENEGAL_BOUNDS.minLatitude &&
      value.latitude <= SENEGAL_BOUNDS.maxLatitude &&
      value.longitude >= SENEGAL_BOUNDS.minLongitude &&
      value.longitude <= SENEGAL_BOUNDS.maxLongitude
    );
  }

  toValue(): GeoCoordinateValue {
    return {
      latitude: this.latitude,
      longitude: this.longitude,
    };
  }
}
