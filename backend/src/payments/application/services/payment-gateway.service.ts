import { Injectable, Inject } from '@nestjs/common';
import {
  PAYMENT_GATEWAY_PORT,
  type PaymentGateway,
  type PaymentGatewayResponse,
  type PaymentMethod,
} from '../ports/payment-gateway.port';

@Injectable()
export class PaymentGatewayService {
  constructor(
    @Inject(PAYMENT_GATEWAY_PORT)
    private readonly gateway: PaymentGateway,
  ) {}

  async initiatePayment(params: {
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
  }): Promise<PaymentGatewayResponse> {
    return this.gateway.initiatePayment(params);
  }

  verifyPayment(gatewayReference: string): Promise<PaymentGatewayResponse> {
    return this.gateway.verifyPayment(gatewayReference);
  }

  async processRefund(params: {
    gatewayReference: string;
    amount: number;
    reason: string;
  }): Promise<PaymentGatewayResponse> {
    return this.gateway.processRefund(params);
  }

  getSupportedMethods(): string[] {
    return this.gateway.getSupportedMethods();
  }
}
