import { Global, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
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
      envFilePath: ['.env', '.env.local', 'backend/.env', 'backend/.env.local'],
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
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => [
        {
          name: 'short',
          ttl: configService.get<number>('THROTTLE_SHORT_TTL', 1000),
          limit: configService.get<number>('THROTTLE_SHORT_LIMIT', 10),
        },
        {
          name: 'medium',
          ttl: configService.get<number>('THROTTLE_MEDIUM_TTL', 60_000),
          limit: configService.get<number>('THROTTLE_MEDIUM_LIMIT', 60),
        },
        {
          name: 'long',
          ttl: configService.get<number>('THROTTLE_LONG_TTL', 600_000),
          limit: configService.get<number>('THROTTLE_LONG_LIMIT', 200),
        },
      ],
    }),
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
