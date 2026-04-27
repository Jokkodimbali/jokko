import { type DomainEvent } from './domain-event.base';

/**
 * Shared domain event dispatcher.
 * Collects and publishes domain events across all bounded contexts.
 */
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

/**
 * Symbol for dependency injection of the DomainEventDispatcher.
 */
export const DOMAIN_EVENT_DISPATCHER = Symbol('DOMAIN_EVENT_DISPATCHER');
