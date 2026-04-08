import { EventEmitter2 } from '@nestjs/event-emitter';
import type { DomaineEventBusPort } from './domaine-event-bus.port';
import type { DomaineEvent } from './domaine-event';
export declare class NestDomaineEventBusAdapter implements DomaineEventBusPort {
    private readonly eventEmitter;
    constructor(eventEmitter: EventEmitter2);
    publier(event: DomaineEvent): Promise<void>;
}
