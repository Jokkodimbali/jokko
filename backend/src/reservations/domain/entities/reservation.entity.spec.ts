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
    reservation.markAsPaid();
    reservation.markAsNoShow();

    expect(() => reservation.cancel('Trop tard')).toThrow(
      /statut actuel|deja terminee ou annulee/i,
    );
  });

  it('requires payment before completing a confirmed reservation', () => {
    const reservation = buildEntity();

    expect(() => reservation.markAsCompleted()).toThrow(/doit etre payee/i);
  });

  it('creates client reservations as confirmed without provider confirmation', () => {
    const reservation = buildEntity();

    expect(reservation.toView().statut).toBe('CONFIRMEE');
  });

  it('allows marking a confirmed reservation as paid after client payment', () => {
    const reservation = buildEntity();

    reservation.markAsPaid();

    expect(reservation.toView().statut).toBe('PAYEE_SEQUESTRE');
  });

  it('allows opening a dispute for a paid reservation after the scheduled end', () => {
    const reservation = ReservationEntity.reconstitute({
      ...buildEntity().toView(),
      dateHeure: new Date(Date.now() - 2 * 60 * 60 * 1000),
      dureeMinutes: 60,
      statut: 'PAYEE_SEQUESTRE',
    });

    reservation.openDispute('Le prestataire ne sest pas presente.');

    expect(reservation.toView().statut).toBe('LITIGE');
  });

  it('rejects opening a dispute for a paid reservation before the scheduled end', () => {
    const reservation = ReservationEntity.reconstitute({
      ...buildEntity().toView(),
      dateHeure: new Date(Date.now() - 15 * 60 * 1000),
      dureeMinutes: 60,
      statut: 'PAYEE_SEQUESTRE',
    });

    expect(() => reservation.openDispute('Trop tot.')).toThrow(/litige/i);
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
