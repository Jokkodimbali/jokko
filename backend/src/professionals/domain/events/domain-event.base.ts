/**
 * Base class for all domain events.
 * Domain events represent something meaningful that happened in the domain.
 */
export abstract class DomainEvent {
  public readonly occurredAt: Date;

  constructor(public readonly aggregateId: string) {
    this.aggregateId = aggregateId;
    this.occurredAt = new Date();
  }
}
