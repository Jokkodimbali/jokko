import { type DomainEvent } from './domain-event.base';

export class DomainEventDispatcher {
  private readonly events: DomainEvent[] = [];

  publish(event: DomainEvent): void {
    this.events.push(event);
  }

  publishMany(events: DomainEvent[]): void {
    this.events.push(...events);
  }

  getEvents(): readonly DomainEvent[] {
    return [...this.events];
  }

  clear(): void {
    this.events.length = 0;
  }
}

export const DOMAIN_EVENT_DISPATCHER = Symbol('DOMAIN_EVENT_DISPATCHER');
