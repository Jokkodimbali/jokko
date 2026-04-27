import { DomainEvent } from '../../../shared/domain/events/domain-event.base';

export class CategoryCreated extends DomainEvent {
  constructor(
    aggregateId: string,
    public readonly name: string,
    public readonly iconUrl: string | null,
    public readonly sortOrder: number,
  ) {
    super(aggregateId);
  }
}

export class CategoryUpdated extends DomainEvent {
  constructor(
    aggregateId: string,
    public readonly name: string,
    public readonly iconUrl: string | null,
    public readonly sortOrder: number,
  ) {
    super(aggregateId);
  }
}

export class CategoryDisabled extends DomainEvent {
  constructor(aggregateId: string) {
    super(aggregateId);
  }
}
