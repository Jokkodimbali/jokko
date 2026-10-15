import { of, throwError } from 'rxjs';
import { AppointmentsService } from './appointments.service';

describe('AppointmentsService geocoding cache', () => {
  it('retente une adresse après un résultat vide ou une erreur temporaire', () => {
    const service = Object.create(AppointmentsService.prototype) as AppointmentsService;
    const geocodeAddress = vi.fn()
      .mockReturnValueOnce(of(null))
      .mockReturnValueOnce(throwError(() => new Error('network')))
      .mockReturnValueOnce(of({ latitude: 14.7, longitude: -17.45 }));
    (service as unknown as { mapsApi: { geocodeAddress: typeof geocodeAddress } }).mapsApi = {
      geocodeAddress,
    };
    (service as unknown as { geocodeCache: Map<string, unknown> }).geocodeCache = new Map();

    service.geocodeAddress('Dakar').subscribe((result) => expect(result).toBeNull());
    service.geocodeAddress('Dakar').subscribe({ error: () => undefined });
    service.geocodeAddress('Dakar').subscribe((result) =>
      expect(result).toMatchObject({ latitude: 14.7, longitude: -17.45 }),
    );
    service.geocodeAddress('Dakar').subscribe();

    expect(geocodeAddress).toHaveBeenCalledTimes(3);
  });
});
