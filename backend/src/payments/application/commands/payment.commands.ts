import {
  type PaymentMethod,
  type PaymentStatus,
  type EscrowStatus,
} from '../../domain/value-objects/payment-types.vo';

export class InitiatePaymentCommand {
  constructor(
    public readonly bookingId: string,
    public readonly method: PaymentMethod,
    public readonly callbackUrl?: string,
    public readonly successUrl?: string,
    public readonly cancelUrl?: string,
  ) {}
}

export class ProcessPaymentWebhookCommand {
  constructor(
    public readonly gatewayReference: string,
    public readonly status: PaymentStatus,
    public readonly data: Record<string, unknown>,
  ) {}
}

export class ReleaseEscrowCommand {
  constructor(public readonly paymentId: string) {}
}

export class DisputeEscrowCommand {
  constructor(
    public readonly paymentId: string,
    public readonly reason?: string,
  ) {}
}

export class RefundPaymentCommand {
  constructor(
    public readonly paymentId: string,
    public readonly reason?: string,
  ) {}
}

export class RequestWithdrawalCommand {
  constructor(
    public readonly professionalId: string,
    public readonly amount: number,
    public readonly method: PaymentMethod,
  ) {}
}

export class GetPaymentHistoryCommand {
  constructor(
    public readonly userId: string,
    public readonly userType: 'CLIENT' | 'PROFESSIONAL',
    public readonly filters?: {
      status?: PaymentStatus;
      method?: PaymentMethod;
      escrowStatus?: EscrowStatus;
      limit?: number;
      offset?: number;
    },
  ) {}
}
