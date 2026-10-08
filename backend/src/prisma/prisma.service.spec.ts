import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaService } from './prisma.service';

jest.mock('@prisma/adapter-pg', () => ({
  PrismaPg: jest.fn(),
}));

jest.mock('@prisma/client', () => ({
  PrismaClient: class {
    $queryRaw = jest.fn().mockResolvedValue([{ '?column?': 1 }]);
    $disconnect = jest.fn().mockResolvedValue(undefined);
  },
}));

describe('PrismaService lifecycle', () => {
  const originalDatabaseUrl = process.env.DATABASE_URL;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.DATABASE_URL =
      'postgresql://user:password@localhost:5432/jokko';
  });

  afterEach(() => {
    if (originalDatabaseUrl === undefined) {
      delete process.env.DATABASE_URL;
    } else {
      process.env.DATABASE_URL = originalDatabaseUrl;
    }
  });

  it('checks SQL connectivity before initialization completes', async () => {
    const service = new PrismaService();

    await service.onModuleInit();

    expect(service.$queryRaw).toHaveBeenCalledWith(['SELECT 1']);
    expect(service.$disconnect).not.toHaveBeenCalled();
  });

  it('fails startup and releases connections when PostgreSQL is unavailable', async () => {
    const service = new PrismaService();
    const cause = new Error('Connection terminated due to connection timeout');
    jest.mocked(service.$queryRaw).mockRejectedValue(cause);

    await expect(service.onModuleInit()).rejects.toMatchObject({
      message: expect.stringContaining('Connexion PostgreSQL impossible'),
      cause,
    });
    expect(service.$disconnect).toHaveBeenCalledTimes(1);
  });

  it('gives ownership of the pool to the adapter and disconnects on shutdown', async () => {
    const service = new PrismaService();

    expect(PrismaPg).toHaveBeenCalledWith({
      connectionString: process.env.DATABASE_URL,
      connectionTimeoutMillis: 10000,
      idleTimeoutMillis: 30000,
      allowExitOnIdle: true,
    });
    await service.onModuleDestroy();
    expect(service.$disconnect).toHaveBeenCalledTimes(1);
  });
});
