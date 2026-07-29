import { GeoCoordinate } from './geo-coordinate.value-object';

describe('GeoCoordinate', () => {
  it('accepts a coordinate inside Senegal', () => {
    expect(
      GeoCoordinate.create({
        latitude: 14.7167,
        longitude: -17.4677,
      }).toValue(),
    ).toEqual({
      latitude: 14.7167,
      longitude: -17.4677,
    });
  });

  it('accepts real coordinates without restricting them to Senegal', () => {
    expect(
      GeoCoordinate.create({ latitude: 48.8566, longitude: 2.3522 }).toValue(),
    ).toEqual({ latitude: 48.8566, longitude: 2.3522 });
  });

  it('rejects non-finite and impossible coordinates', () => {
    expect(() =>
      GeoCoordinate.create({ latitude: Number.NaN, longitude: -17.4 }),
    ).toThrow('INVALID_GEO_COORDINATE');
    expect(() =>
      GeoCoordinate.create({ latitude: 91, longitude: 2.3522 }),
    ).toThrow('INVALID_GEO_COORDINATE');
  });
});
