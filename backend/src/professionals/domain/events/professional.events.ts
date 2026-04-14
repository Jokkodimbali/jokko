import { DomainEvent } from './domain-event.base';

export class ProfessionalProfileCreated extends DomainEvent {
  constructor(
    aggregateId: string,
    public readonly utilisateurId: string,
    public readonly biographie: string | null,
    public readonly nomEntreprise: string | null,
    public readonly ville: string | null,
  ) {
    super(aggregateId);
  }
}

export class ProfessionalProfileUpdated extends DomainEvent {
  constructor(
    aggregateId: string,
    public readonly biographie: string | null,
    public readonly nomEntreprise: string | null,
    public readonly ville: string | null,
  ) {
    super(aggregateId);
  }
}

export class ProfessionalKycSubmitted extends DomainEvent {
  constructor(
    aggregateId: string,
    public readonly idCardUrl: string,
  ) {
    super(aggregateId);
  }
}

export class ProfessionalKycApproved extends DomainEvent {
  constructor(aggregateId: string) {
    super(aggregateId);
  }
}

export class ProfessionalKycRejected extends DomainEvent {
  constructor(
    aggregateId: string,
    public readonly reason: string,
  ) {
    super(aggregateId);
  }
}

export class ProfessionalServiceCreated extends DomainEvent {
  constructor(
    aggregateId: string,
    public readonly serviceId: string,
    public readonly categoryId: string,
    public readonly name: string,
    public readonly price: number,
  ) {
    super(aggregateId);
  }
}

export class ProfessionalServiceDisabled extends DomainEvent {
  constructor(
    aggregateId: string,
    public readonly serviceId: string,
  ) {
    super(aggregateId);
  }
}

export class ProfessionalPortfolioItemAdded extends DomainEvent {
  constructor(
    aggregateId: string,
    public readonly itemId: string,
    public readonly title: string,
  ) {
    super(aggregateId);
  }
}

export class ProfessionalPortfolioItemRemoved extends DomainEvent {
  constructor(
    aggregateId: string,
    public readonly itemId: string,
  ) {
    super(aggregateId);
  }
}

export class ProfessionalAvailabilitySlotCreated extends DomainEvent {
  constructor(
    aggregateId: string,
    public readonly availabilityId: string,
    public readonly dayOfWeek: number,
  ) {
    super(aggregateId);
  }
}
