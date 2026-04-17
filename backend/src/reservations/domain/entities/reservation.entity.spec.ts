import { ReservationEntity } from './reservation.entity';

describe('ReservationEntity', () => {
  function buildFutureDate(hoursAhead: number = 24): Date {
    return new Date(Date.now() + hoursAhead * 60 * 60 * 1000);
  }

  function buildEntity() {
    return ReservationEntity.create({
      id: 'reservation-id',
      clientId: 'client-id',
      professionnelId: 'professional-id',
      serviceId: 'service-id',
      dateHeure: buildFutureDate(),
      adresseClient: 'Dakar Plateau',
      dureeMinutes: 60,
      notes: 'Intervention standard',
      prixConvenu: 25000,
    });
  }

  it('requires a non-empty client address', () => {
    expect(() =>
      ReservationEntity.create({
        id: 'reservation-id',
        clientId: 'client-id',
        professionnelId: 'professional-id',
        serviceId: 'service-id',
        dateHeure: buildFutureDate(),
        adresseClient: '   ',
        dureeMinutes: 60,
      }),
    ).toThrow(/adresse du client/i);
  });

  it('does not allow cancelling a no-show reservation', () => {
    const reservation = buildEntity();
    reservation.confirm();
    reservation.markAsNoShow();

    expect(() => reservation.cancel('Trop tard')).toThrow(
      /statut actuel|deja terminee ou annulee/i,
    );
  });

  it('rejects invalid reconstituted dates', () => {
    expect(() =>
      ReservationEntity.reconstitute({
        id: 'reservation-id',
        clientId: 'client-id',
        professionnelId: 'professional-id',
        serviceId: 'service-id',
        dateHeure: new Date('invalid'),
        adresseClient: 'Dakar Plateau',
        dureeMinutes: 60,
        statut: 'EN_ATTENTE',
        notes: null,
        prixConvenu: 25000,
        raisonAnnulation: null,
        creeLe: new Date(),
        misAJourLe: new Date(),
      }),
    ).toThrow(/invalides/i);
  });

  it('returns defensive copies for reservation dates', () => {
    const reservation = buildEntity();
    const view = reservation.toView();

    view.dateHeure.setFullYear(2035);

    expect(reservation.dateHeure.getFullYear()).not.toBe(2035);
  });
});
