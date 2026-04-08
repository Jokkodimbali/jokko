import { Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import type { DomaineEventBusPort } from './domaine-event-bus.port';
import type { DomaineEvent } from './domaine-event';

@Injectable()
export class NestDomaineEventBusAdapter implements DomaineEventBusPort {
  constructor(private readonly eventEmitter: EventEmitter2) {}

  publier(event: DomaineEvent): Promise<void> {
    this.eventEmitter.emit(event.nom, event);
    return Promise.resolve();
  }
}
