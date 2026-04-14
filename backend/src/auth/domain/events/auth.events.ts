import { DomainEvent } from './domain-event.base';

export class AuthUserRegistered extends DomainEvent {
  constructor(
    aggregateId: string,
    public readonly phoneNumber: string,
    public readonly name: string,
  ) {
    super(aggregateId);
  }
}

export class AuthUserLoggedIn extends DomainEvent {
  constructor(
    aggregateId: string,
    public readonly phoneNumber: string,
  ) {
    super(aggregateId);
  }
}

export class AuthUserLoggedOut extends DomainEvent {
  constructor(aggregateId: string) {
    super(aggregateId);
  }
}

export class AuthGoogleAccountLinked extends DomainEvent {
  constructor(
    aggregateId: string,
    public readonly googleSub: string,
  ) {
    super(aggregateId);
  }
}

export class AuthOtpSent extends DomainEvent {
  constructor(
    aggregateId: string,
    public readonly phoneNumber: string,
  ) {
    super(aggregateId);
  }
}

export class AuthOtpVerified extends DomainEvent {
  constructor(
    aggregateId: string,
    public readonly phoneNumber: string,
  ) {
    super(aggregateId);
  }
}

export class AuthPasswordChanged extends DomainEvent {
  constructor(aggregateId: string) {
    super(aggregateId);
  }
}

export class AuthSessionRevoked extends DomainEvent {
  constructor(
    aggregateId: string,
    public readonly sessionId: string,
  ) {
    super(aggregateId);
  }
}
