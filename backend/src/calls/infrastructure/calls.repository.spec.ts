import { StatutAppel } from '@prisma/client';
import { CallsRepository } from './calls.repository';

describe('CallsRepository transitions', () => {
  const updateMany = jest.fn();
  const findMany = jest.fn();
  const prisma = { appel: { updateMany, findMany } };
  const repository = new CallsRepository(prisma as never);

  beforeEach(() => {
    updateMany.mockReset();
    findMany.mockReset();
  });

  it('returns the real connected-call duration in seconds', async () => {
    findMany.mockResolvedValueOnce([
      {
        id: 'call-1',
        conversationId: 'conversation-1',
        appelantId: 'caller-1',
        destinataireId: 'recipient-1',
        type: 'VOCAL',
        statut: 'TERMINE',
        sonneLe: new Date('2026-08-06T10:00:00.000Z'),
        accepteLe: new Date('2026-08-06T10:00:05.000Z'),
        termineLe: new Date('2026-08-06T10:03:17.800Z'),
        appelant: { id: 'caller-1', nom: 'Client', urlAvatar: null },
        destinataire: {
          id: 'recipient-1',
          nom: 'Prestataire',
          urlAvatar: null,
        },
      },
    ]);

    const history = await repository.listForUser('caller-1', 50, 0);

    expect(history[0]?.durationSeconds).toBe(192);
  });

  it('marks an unanswered ringing call as missed when someone hangs up', async () => {
    updateMany.mockResolvedValueOnce({ count: 1 });

    await expect(
      repository.transition({
        id: 'call-1',
        actorId: 'caller-1',
        from: ['RINGING', 'ACCEPTED'],
        to: 'ENDED',
      }),
    ).resolves.toBe(true);

    expect(updateMany).toHaveBeenCalledTimes(1);
    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ statut: StatutAppel.SONNE }),
        data: expect.objectContaining({ statut: StatutAppel.MANQUE }),
      }),
    );
  });

  it('ends an accepted call without changing it to missed', async () => {
    updateMany
      .mockResolvedValueOnce({ count: 0 })
      .mockResolvedValueOnce({ count: 1 });

    await expect(
      repository.transition({
        id: 'call-2',
        actorId: 'recipient-1',
        from: ['RINGING', 'ACCEPTED'],
        to: 'ENDED',
      }),
    ).resolves.toBe(true);

    expect(updateMany).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: expect.objectContaining({
          statut: { in: [StatutAppel.ACCEPTE] },
        }),
        data: expect.objectContaining({ statut: StatutAppel.TERMINE }),
      }),
    );
  });

  it.each([
    ['ACCEPTED', StatutAppel.ACCEPTE],
    ['REJECTED', StatutAppel.REFUSE],
  ] as const)(
    'keeps the ringing state eligible for %s',
    async (status, databaseStatus) => {
      updateMany.mockResolvedValueOnce({ count: 1 });

      await repository.transition({
        id: 'call-3',
        actorId: 'recipient-1',
        from: ['RINGING'],
        to: status,
      });

      expect(updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            statut: { in: [StatutAppel.SONNE] },
          }),
          data: expect.objectContaining({ statut: databaseStatus }),
        }),
      );
    },
  );
});
