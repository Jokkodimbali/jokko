import { MessagingRepository } from './messaging.repository';
import { type PrismaService } from '../../../prisma/prisma.service';

describe('conversation history', () => {
  it('only loads messages belonging to the selected private conversation', async () => {
    const sender = {
      id: 'admin',
      nom: 'Moderation',
      urlAvatar: null,
      role: 'ADMIN',
    };
    const message = (id: string, minute: number, litigeId: string | null = null) => ({
      id,
      conversationId: 'conversation',
      litigeId,
      expediteurId: 'admin',
      contenu: id,
      urlMedia: null,
      estLu: true,
      creeLe: new Date(minute * 60_000),
      expediteur: sender,
    });
    const prisma = {
      message: {
        findMany: jest.fn().mockResolvedValue([message('older', 1)]),
      },
    };
    const repository = new MessagingRepository(
      prisma as unknown as PrismaService,
    );
    const result = await repository.listMessages({
      currentUserId: 'recipient',
      conversationId: 'conversation',
      offset: 1,
      limit: 2,
    });
    expect(result.map((item) => item.id)).toEqual(['older']);
    expect(prisma.message.findMany).toHaveBeenCalledWith({
      where: { conversationId: 'conversation' },
      orderBy: [{ creeLe: 'desc' }, { id: 'desc' }],
      take: 2,
      skip: 1,
      select: expect.any(Object),
    });
    expect(result[0].sender).toMatchObject({
      id: 'admin',
      isAdmin: true,
      name: 'Service client',
      avatarUrl: '/logojokko.png',
    });
  });

  it('returns the dispute linked to the latest Support message', async () => {
    const prisma = {
      message: {
        findFirst: jest.fn().mockResolvedValue({ litigeId: 'dispute-1' }),
      },
    };
    const repository = new MessagingRepository(prisma as unknown as PrismaService);

    await expect(repository.findLatestDisputeIdInConversation('support-thread')).resolves.toBe(
      'dispute-1',
    );
    expect(prisma.message.findFirst).toHaveBeenCalledWith({
      where: { conversationId: 'support-thread', litigeId: { not: null } },
      orderBy: [{ creeLe: 'desc' }, { id: 'desc' }],
      select: { litigeId: true },
    });
  });
});
