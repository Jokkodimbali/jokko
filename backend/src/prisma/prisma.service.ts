import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { Pool, type PoolConfig } from 'pg';
import { appMessage } from '../core/http/app-http.exception';

function normalizeDatabaseUrl(connectionString: string): string {
  try {
    const url = new URL(connectionString);
    if (url.protocol === 'postgresql:' && url.hostname.endsWith('.neon.tech')) {
      const sslMode = url.searchParams.get('sslmode');
      if (!sslMode || ['prefer', 'require', 'verify-ca'].includes(sslMode)) {
        url.searchParams.set('sslmode', 'verify-full');
      }
      return url.toString();
    }
  } catch {
    return connectionString;
  }

  return connectionString;
}

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  // Les modeles sont herites de PrismaClient.

  constructor() {
    const rawConnectionString = process.env.DATABASE_URL;
    if (!rawConnectionString) {
      throw new Error(appMessage('SYSTEM_DATABASE_URL_MISSING').message);
    }
    const connectionString = normalizeDatabaseUrl(rawConnectionString);

    const poolConfig: PoolConfig = {
      connectionString,
      connectionTimeoutMillis: 10000,
      idleTimeoutMillis: 30000,
      allowExitOnIdle: true,
    };

    const adapter = new PrismaPg(new Pool(poolConfig));

    super({ adapter });
  }

  onModuleDestroy(): Promise<void> {
    return this.disconnectClient();
  }

  private async disconnectClient(): Promise<void> {
    await super.$disconnect();
  }
}
