import { $Enums } from '@prisma/client';
import { ReservationsRepository } from './reservations.repository';

type ReservationPrismaMock = {
  reservation: {
    findMany: jest.Mock;
    updateMany: jest.Mock;
  };
};

describe('ReservationsRepository', () => {
  it('does not use the removed pending reservation status for no-show sync', async () => {
    const now = new Date('2026-06-11T12:00:00.000Z');
    const prisma: ReservationPrismaMock = {
      reservation: {
        findMany: jest.fn(),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
    };
    const repository = new ReservationsRepository(prisma as never);

    const count = await repository.syncOverdueReservations(now);

    expect(count).toBe(0);
    expect(prisma.reservation.findMany).not.toHaveBeenCalled();
    expect(prisma.reservation.updateMany).toHaveBeenCalledTimes(1);
  });

  it('does not mark confirmed reservations as no-show automatically', async () => {
    const now = new Date('2026-06-11T10:30:00.000Z');
    const prisma: ReservationPrismaMock = {
      reservation: {
        findMany: jest.fn(),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
    };
    const repository = new ReservationsRepository(prisma as never);

    const count = await repository.syncOverdueReservations(now);

    expect(count).toBe(0);
    expect(prisma.reservation.updateMany).toHaveBeenCalledTimes(1);
  });

  it('syncs successful locked payments before checking no-show reservations', async () => {
    const now = new Date('2026-06-11T12:00:00.000Z');
    const prisma: ReservationPrismaMock = {
      reservation: {
        findMany: jest.fn().mockResolvedValue([]),
        updateMany: jest.fn().mockResolvedValueOnce({ count: 1 }),
      },
    };
    const repository = new ReservationsRepository(prisma as never);

    const count = await repository.syncOverdueReservations(now);

    expect(count).toBe(1);
    expect(prisma.reservation.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          statut: $Enums.StatutReservation.CONFIRMEE,
          paiement: {
            is: {
              statut: $Enums.StatutPaiement.SUCCES,
              escrowStatus: $Enums.EscrowStatus.LOCKED,
            },
          },
        }),
        data: expect.objectContaining({
          statut: $Enums.StatutReservation.PAYEE_SEQUESTRE,
          misAJourLe: now,
        }),
      }),
    );
  });

  it('detects overlapping active reservations for the same professional', async () => {
    const existingReservationStart = new Date('2030-01-01T10:30:00.000Z');
    const prisma: ReservationPrismaMock = {
      reservation: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'existing-reservation',
            dateHeure: existingReservationStart,
            dureeMinutes: 60,
          },
        ]),
        updateMany: jest.fn(),
      },
    };
    const repository = new ReservationsRepository(prisma as never);

    const hasConflict = await repository.hasTimeSlotConflict({
      professionalId: 'professional-id',
      dateHeure: new Date('2030-01-01T10:00:00.000Z'),
      dureeMinutes: 60,
    });

    expect(hasConflict).toBe(true);
    expect(prisma.reservation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          professionnelId: 'professional-id',
          statut: {
            notIn: [
              $Enums.StatutReservation.ANNULEE,
              $Enums.StatutReservation.TERMINEE,
              $Enums.StatutReservation.NO_SHOW,
            ],
          },
        }),
        select: {
          id: true,
          dateHeure: true,
          dureeMinutes: true,
        },
      }),
    );
  });
});
