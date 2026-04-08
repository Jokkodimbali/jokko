import { Global, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { validerEnv } from './config/env.validation';
import { DOMAINE_EVENT_BUS } from './events/domaine-event-bus.port';
import { NestDomaineEventBusAdapter } from './events/nest-domaine-event-bus.adapter';

@Global()
@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate: validerEnv,
    }),
    EventEmitterModule.forRoot({
      wildcard: false,
      delimiter: '.',
      newListener: false,
      removeListener: false,
      maxListeners: 20,
      verboseMemoryLeak: true,
      ignoreErrors: false,
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60_000,
        limit: 60,
      },
    ]),
  ],
  providers: [
    NestDomaineEventBusAdapter,
    {
      provide: DOMAINE_EVENT_BUS,
      useExisting: NestDomaineEventBusAdapter,
    },
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
  exports: [DOMAINE_EVENT_BUS],
})
export class CoreModule {}
