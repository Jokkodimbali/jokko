export const PAYMENT_WEBHOOK_SECURITY_PORT = Symbol(
  'PAYMENT_WEBHOOK_SECURITY_PORT',
);

export interface PaymentWebhookSecurityPort {
  verifySignature(params: {
    rawPayload: string;
    signature?: string;
    timestamp?: string;
  }): boolean;
}
