export const PAYMENT_GATEWAY_PORT = Symbol('PAYMENT_GATEWAY_PORT');

import type { PaymentMethod } from '../../domain/value-objects/payment-types.vo';
export type { PaymentMethod } from '../../domain/value-objects/payment-types.vo';

export interface PaymentGatewayResponse {
  success: boolean;
  gatewayReference?: string;
  paymentUrl?: string;
  error?: string;
  data?: Record<string, unknown>;
}

export interface PaymentGateway {
  initiatePayment(params: {
    amount: number;
    currency: string;
    description: string;
    customerName: string;
    customerEmail?: string;
    customerPhone?: string;
    callbackUrl?: string;
    successUrl?: string;
    cancelUrl?: string;
    metadata?: Record<string, unknown>;
    method: PaymentMethod;
  }): Promise<PaymentGatewayResponse>;

  verifyPayment(gatewayReference: string): Promise<PaymentGatewayResponse>;

  processRefund(params: {
    gatewayReference: string;
    amount: number;
    reason: string;
  }): Promise<PaymentGatewayResponse>;

  getSupportedMethods(): PaymentMethod[];
}

export interface PaymentGatewayAdapter extends PaymentGateway {
  supports(method: PaymentMethod): boolean;
}
