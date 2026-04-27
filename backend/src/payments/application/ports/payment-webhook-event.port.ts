export const PAYMENT_WEBHOOK_EVENT_PORT = Symbol('PAYMENT_WEBHOOK_EVENT_PORT');

export type PaymentWebhookEventRecord = {
  id: string;
  eventKey: string;
  providerReference: string;
  providerStatus: string;
  isReplay: boolean;
};

export interface PaymentWebhookEventPort {
  recordReceived(params: {
    eventKey: string;
    provider: string;
    providerReference: string;
    providerStatus: string;
    signatureValid: boolean;
    payload: Record<string, unknown>;
  }): Promise<PaymentWebhookEventRecord>;
  markProcessed(eventKey: string): Promise<void>;
  markFailed(eventKey: string, error: string): Promise<void>;
}
