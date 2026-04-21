import { DomainEvent } from '../../../shared/domain/events/domain-event.base';

export class PaymentInitiatedEvent extends DomainEvent {
  constructor(
    public readonly paymentId: string,
    public readonly bookingId: string,
    public readonly clientId: string,
    public readonly professionalId: string,
    public readonly amount: number,
    public readonly method: string,
  ) {
    super(paymentId);
  }
}

export class PaymentSucceededEvent extends DomainEvent {
  constructor(
    public readonly paymentId: string,
    public readonly bookingId: string,
    public readonly amount: number,
    public readonly gatewayReference: string,
  ) {
    super(paymentId);
  }
}

export class PaymentFailedEvent extends DomainEvent {
  constructor(
    public readonly paymentId: string,
    public readonly bookingId: string,
    public readonly reason: string,
  ) {
    super(paymentId);
  }
}

export class EscrowReleasedEvent extends DomainEvent {
  constructor(
    public readonly paymentId: string,
    public readonly bookingId: string,
  ) {
    super(paymentId);
  }
}

export class EscrowRefundedEvent extends DomainEvent {
  constructor(
    public readonly paymentId: string,
    public readonly bookingId: string,
    public readonly reason?: string,
  ) {
    super(paymentId);
  }
}

export class EscrowDisputedEvent extends DomainEvent {
  constructor(
    public readonly paymentId: string,
    public readonly bookingId: string,
    public readonly reason?: string,
  ) {
    super(paymentId);
  }
}

export class WithdrawalRequestedEvent extends DomainEvent {
  constructor(
    public readonly withdrawalId: string,
    public readonly professionalId: string,
    public readonly amount: number,
    public readonly method: string,
  ) {
    super(withdrawalId);
  }
}

export class WithdrawalCompletedEvent extends DomainEvent {
  constructor(
    public readonly withdrawalId: string,
    public readonly professionalId: string,
    public readonly amount: number,
  ) {
    super(withdrawalId);
  }
}
