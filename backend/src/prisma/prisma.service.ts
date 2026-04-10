import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';
import { Pool, type PoolConfig } from 'pg';
import { appMessage } from '../core/http/app-http.exception';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  // Les modeles sont herites de PrismaClient.

  constructor() {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error(appMessage('SYSTEM_DATABASE_URL_MISSING').message);
    }

    const poolConfig: PoolConfig = {
      connectionString,
      connectionTimeoutMillis: 2000,
      idleTimeoutMillis: 5000,
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
