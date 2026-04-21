import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  PaymentGateway,
  PaymentGatewayResponse,
  type PaymentMethod,
} from '../../application/ports/payment-gateway.port';
import { PaymentMethod as DomainPaymentMethod } from '../../domain/value-objects/payment-types.vo';

@Injectable()
export class MockPaymentGatewayAdapter implements PaymentGateway {
  private readonly pendingPayments: Map<
    string,
    { amount: number; status: string; metadata: Record<string, unknown> }
  > = new Map();

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
  }): Promise<PaymentGatewayResponse> {
    const gatewayReference = randomUUID();
    const paymentUrl = this.getPaymentUrl(
      params.method,
      params.amount,
      gatewayReference,
    );
    this.pendingPayments.set(gatewayReference, {
      amount: params.amount,
      status: 'PENDING' as const,
      metadata: params.metadata || {},
    });

    return Promise.resolve({
      success: true,
      gatewayReference,
      paymentUrl,
      data: { reference: gatewayReference, status: 'PENDING' },
    });
  }

  verifyPayment(gatewayReference: string): Promise<PaymentGatewayResponse> {
    const payment = this.pendingPayments.get(gatewayReference);
    if (!payment) {
      return Promise.resolve({
        success: false,
        error: 'Payment not found',
      });
    }

    const status = Math.random() > 0.2 ? 'SUCCESS' : 'FAILED';

    return Promise.resolve({
      success: true,
      gatewayReference,
      data: {
        status,
        amount: payment.amount,
      },
    });
  }

  processRefund(params: {
    gatewayReference: string;
    amount: number;
    reason: string;
  }): Promise<PaymentGatewayResponse> {
    return Promise.resolve({
      success: true,
      gatewayReference: params.gatewayReference,
      data: { refunded: true, amount: params.amount },
    });
  }

  getSupportedMethods(): PaymentMethod[] {
    return [
      DomainPaymentMethod.WAVE,
      DomainPaymentMethod.ORANGE_MONEY,
      DomainPaymentMethod.CARD,
    ];
  }

  validateWebhookSignature(): boolean {
    return true;
  }

  private getPaymentUrl(
    method: PaymentMethod,
    amount: number,
    ref: string,
  ): string {
    switch (method) {
      case DomainPaymentMethod.WAVE:
        return `wave://pay?amount=${amount}&ref=${ref}`;
      case DomainPaymentMethod.ORANGE_MONEY:
        return `orangemoney://pay?amount=${amount}&ref=${ref}`;
      case DomainPaymentMethod.CARD:
        return `https://jokko.sn/pay-card?amount=${amount}&ref=${ref}`;
      default:
        throw new Error('Unsupported method');
    }
  }
}
