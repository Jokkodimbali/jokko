import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { type PoolConfig } from 'pg';
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
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
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

    // Let the adapter own the pool so $disconnect also closes its connections.
    const adapter = new PrismaPg(poolConfig);

    super({ adapter, errorFormat: 'minimal' });
  }

  async onModuleInit(): Promise<void> {
    try {
      // With the pg adapter, $connect alone does not execute a database query.
      // Verify connectivity before Nest starts accepting requests.
      await this.$queryRaw`SELECT 1`;
    } catch (cause) {
      await this.$disconnect();
      throw new Error(
        'Connexion PostgreSQL impossible au demarrage. Verifiez DATABASE_URL, la disponibilite de la base et votre connexion reseau.',
        { cause },
      );
    }
  }

  onModuleDestroy(): Promise<void> {
    return this.$disconnect();
  }
}
