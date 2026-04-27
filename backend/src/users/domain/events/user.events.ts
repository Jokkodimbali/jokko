import { DomainEvent } from './domain-event.base';

export class UserProfileUpdated extends DomainEvent {
  constructor(
    aggregateId: string,
    public readonly changes: {
      name?: string;
      email?: string | null;
      address?: string | null;
      avatarUrl?: string | null;
    },
  ) {
    super(aggregateId);
  }
}

export class UserAvatarUpdated extends DomainEvent {
  constructor(
    aggregateId: string,
    public readonly avatarUrl: string,
  ) {
    super(aggregateId);
  }
}

export class UserAnonymized extends DomainEvent {
  constructor(aggregateId: string) {
    super(aggregateId);
  }
}

export class UserDeactivated extends DomainEvent {
  constructor(aggregateId: string) {
    super(aggregateId);
  }
}

export class UserReactivated extends DomainEvent {
  constructor(aggregateId: string) {
    super(aggregateId);
  }
}
