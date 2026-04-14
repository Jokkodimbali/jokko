export abstract class DomainEvent {
  public readonly occurredAt: Date;

  constructor(public readonly aggregateId: string) {
    this.aggregateId = aggregateId;
    this.occurredAt = new Date();
  }
}
