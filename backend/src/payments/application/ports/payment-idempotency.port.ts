export const PAYMENT_IDEMPOTENCY_PORT = Symbol('PAYMENT_IDEMPOTENCY_PORT');

export type PaymentInitiationCache = {
  paymentId: string;
  paymentUrl: string;
  gatewayReference: string;
};

export type PaymentIdempotencyRecord = {
  key: string;
  scope: string;
  requestHash: string;
  status: 'EN_COURS' | 'TERMINE' | 'ECHEC';
  response: PaymentInitiationCache | null;
  expiresAt: Date;
};

export interface PaymentIdempotencyPort {
  findByKey(key: string): Promise<PaymentIdempotencyRecord | null>;
  createInProgress(params: {
    key: string;
    scope: string;
    requestHash: string;
    expiresAt: Date;
  }): Promise<void>;
  complete(key: string, response: PaymentInitiationCache): Promise<void>;
  fail(key: string): Promise<void>;
}
