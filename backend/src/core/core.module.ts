import { Global, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { validerEnv } from './config/env.validation';
import { DOMAINE_EVENT_BUS } from './events/domaine-event-bus.port';
import { OutboxEventBusService } from './events/outbox-event-bus.service';
import { AuditService } from './audit/audit.service';
import { AuditLoggerMiddleware } from './audit/audit-logger.middleware';

@Global()
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate: validerEnv,
      envFilePath: '.env',
    }),
    EventEmitterModule.forRoot({
      wildcard: false,
      delimiter: '.',
      newListener: false,
      removeListener: false,
      maxListeners: 20,
      verboseMemoryLeak: false,
      ignoreErrors: false,
    }),
    ThrottlerModule.forRoot([
      {
        name: 'short',
        ttl: 1000,
        limit: 10,
      },
      {
        name: 'medium',
        ttl: 60_000,
        limit: 60,
      },
      {
        name: 'long',
        ttl: 600_000,
        limit: 200,
      },
    ]),
  ],
  providers: [
    AuditLoggerMiddleware,
    {
      provide: DOMAINE_EVENT_BUS,
      useExisting: OutboxEventBusService,
    },
    OutboxEventBusService,
    AuditService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
  exports: [
    DOMAINE_EVENT_BUS,
    OutboxEventBusService,
    AuditService,
    AuditLoggerMiddleware,
  ],
})
export class CoreModule {}
