import { ReservationsRepository } from './reservations.repository';
import type { PrismaService } from '../../../prisma/prisma.service';

describe('prescription template snapshot', () => {
  const reservation = {
    id: 'booking-id',
    clientId: 'client-id',
    professionnelId: 'doctor-id',
    serviceId: 'service-id',
    dateHeure: new Date('2026-09-30T10:00:00.000Z'),
    adresseClient: 'Dakar',
    clientLatitude: null,
    clientLongitude: null,
    dureeMinutes: 30,
    statut: 'TERMINEE',
    notes: null,
    typeConsultation: 'CONSULTATION',
    actesPrescriptionMedicale: [],
    vaccinsPrescriptionMedicale: [],
    traitementsPrescriptionMedicale: ['Traitement'],
    prixConvenu: null,
    statutAjustementPrix: 'AUCUN',
    prixAjustementPropose: null,
    raisonAjustementPrix: null,
    demandeAjustementPrixLe: null,
    raisonAnnulation: null,
    clientRating: null,
    clientReview: null,
    clientReviewedAt: null,
    creeLe: new Date('2026-09-30T09:00:00.000Z'),
    misAJourLe: new Date('2026-09-30T11:00:00.000Z'),
  };

  function setup(snapshot: object | null) {
    const tx = {
      $executeRaw: jest.fn().mockResolvedValue(1),
      reservation: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn().mockResolvedValue({
          modeleOrdonnanceSnapshot: snapshot,
          professionnel: { modeleOrdonnance: { structure: 'Cabinet A' } },
        }),
        update: jest.fn().mockResolvedValue(reservation),
      },
    };
    const prisma = { $transaction: jest.fn((callback) => callback(tx)) };
    return {
      repository: new ReservationsRepository(prisma as unknown as PrismaService),
      tx,
    };
  }

  it('captures the doctor model with the first prescription', async () => {
    const { repository, tx } = setup(null);
    await repository.update(reservation as never);
    expect(tx.reservation.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        modeleOrdonnanceSnapshot: { structure: 'Cabinet A' },
      }),
    }));
  });

  it('never replaces an existing model snapshot', async () => {
    const { repository, tx } = setup({ structure: 'Cabinet historique' });
    await repository.update(reservation as never);
    expect(tx.reservation.update.mock.calls[0][0].data).not.toHaveProperty(
      'modeleOrdonnanceSnapshot',
    );
  });
});
