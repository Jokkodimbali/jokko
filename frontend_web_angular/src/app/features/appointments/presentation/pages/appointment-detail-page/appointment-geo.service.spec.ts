import { AppointmentGeoService } from './appointment-geo.service';

describe('AppointmentGeoService', () => {
  const service = new AppointmentGeoService();

  it('accepts a valid coordinate in Senegal for live tracking', () => {
    expect(service.isCoordinateInSenegal(14.7167, -17.4677)).toBe(true);
  });

  it('rejects a valid geographic coordinate outside Senegal', () => {
    expect(service.isCoordinateInSenegal(41.0082, 28.9784)).toBe(false);
  });

  it('still rejects invalid geographic coordinates', () => {
    expect(service.isCoordinateInSenegal(91, 2.3522)).toBe(false);
    expect(service.isCoordinateInSenegal(48.8566, 181)).toBe(false);
  });
});
