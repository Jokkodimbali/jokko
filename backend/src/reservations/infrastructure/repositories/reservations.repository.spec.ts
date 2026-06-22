import { $Enums } from '@prisma/client';
import { ReservationsRepository } from './reservations.repository';

type ReservationPrismaMock = {
  reservation: {
    findMany: jest.Mock;
    updateMany: jest.Mock;
  };
};

describe('ReservationsRepository', () => {
  it('marks only overdue pending reservations as no-show automatically', async () => {
    const now = new Date('2026-06-11T12:00:00.000Z');
    const prisma: ReservationPrismaMock = {
      reservation: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'pending-overdue',
            dateHeure: new Date('2026-06-11T10:00:00.000Z'),
            dureeMinutes: 60,
          },
        ]),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    const repository = new ReservationsRepository(prisma as never);

    const count = await repository.syncOverdueReservations(now);

    expect(count).toBe(1);
    expect(prisma.reservation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          statut: { in: [$Enums.StatutReservation.EN_ATTENTE] },
        }),
      }),
    );
    expect(prisma.reservation.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: { in: ['pending-overdue'] },
          statut: { in: [$Enums.StatutReservation.EN_ATTENTE] },
        }),
        data: expect.objectContaining({
          statut: $Enums.StatutReservation.NO_SHOW,
          misAJourLe: now,
        }),
      }),
    );
  });

  it('does not mark a pending reservation before its planned end time', async () => {
    const now = new Date('2026-06-11T10:30:00.000Z');
    const prisma: ReservationPrismaMock = {
      reservation: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'pending-in-progress-window',
            dateHeure: new Date('2026-06-11T10:00:00.000Z'),
            dureeMinutes: 60,
          },
        ]),
        updateMany: jest.fn(),
      },
    };
    const repository = new ReservationsRepository(prisma as never);

    const count = await repository.syncOverdueReservations(now);

    expect(count).toBe(0);
    expect(prisma.reservation.updateMany).not.toHaveBeenCalled();
  });
});
