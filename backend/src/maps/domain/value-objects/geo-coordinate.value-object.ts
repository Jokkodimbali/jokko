export type GeoCoordinateValue = {
  latitude: number;
  longitude: number;
};

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
      value.latitude >= -90 &&
      value.latitude <= 90 &&
      value.longitude >= -180 &&
      value.longitude <= 180
    );
  }

  toValue(): GeoCoordinateValue {
    return {
      latitude: this.latitude,
      longitude: this.longitude,
    };
  }
}
