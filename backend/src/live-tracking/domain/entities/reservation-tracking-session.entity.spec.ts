import { ReservationTrackingSessionEntity } from './reservation-tracking-session.entity';

describe('ReservationTrackingSessionEntity', () => {
  const baseInput = {
    reservationId: 'reservation-1',
    clientUserId: 'client-1',
    professionalId: 'professional-1',
    professionalUserId: 'professional-user-1',
  };

  it('preserves the device timestamp when a trip starts from a GPS position', () => {
    const recordedAt = new Date('2026-08-10T12:00:00.000Z');
    const session = ReservationTrackingSessionEntity.start({
      ...baseInput,
      latitude: 14.7167,
      longitude: -17.4677,
      recordedAt,
    });

    expect(session.toView().lastPositionAt).toEqual(recordedAt);
  });

  it('keeps the GPS timestamp empty when a trip starts without coordinates', () => {
    const session = ReservationTrackingSessionEntity.start({
      ...baseInput,
      latitude: null,
      longitude: null,
    });

    expect(session.toView().lastPositionAt).toBeNull();
  });
});
