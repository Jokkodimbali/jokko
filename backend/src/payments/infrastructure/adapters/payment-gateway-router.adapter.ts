import { Inject, Injectable } from '@nestjs/common';
import {
  type PaymentGateway,
  type PaymentGatewayAdapter,
  type PaymentGatewayResponse,
  type PaymentMethod,
} from '../../application/ports/payment-gateway.port';
import { PaymentDomainError } from '../../domain/errors/payment.domain-error';
import { PaymentMethod as DomainPaymentMethod } from '../../domain/value-objects/payment-types.vo';

export const PAYMENT_GATEWAY_ADAPTERS = Symbol('PAYMENT_GATEWAY_ADAPTERS');

type InitiatePaymentParams = Parameters<PaymentGateway['initiatePayment']>[0];
type RefundPaymentParams = Parameters<PaymentGateway['processRefund']>[0];

@Injectable()
export class PaymentGatewayRouterAdapter implements PaymentGateway {
  constructor(
    @Inject(PAYMENT_GATEWAY_ADAPTERS)
    private readonly adapters: PaymentGatewayAdapter[],
  ) {}

  initiatePayment(
    params: InitiatePaymentParams,
  ): Promise<PaymentGatewayResponse> {
    return this.getAdapter(params.method).initiatePayment(params);
  }

  verifyPayment(gatewayReference: string): Promise<PaymentGatewayResponse> {
    return this.getAdapterByReference(gatewayReference).verifyPayment(
      gatewayReference,
    );
  }

  processRefund(params: RefundPaymentParams): Promise<PaymentGatewayResponse> {
    return this.getAdapterByReference(params.gatewayReference).processRefund(
      params,
    );
  }

  getSupportedMethods(): PaymentMethod[] {
    return this.adapters.flatMap((adapter) => adapter.getSupportedMethods());
  }

  private getAdapter(method: PaymentMethod): PaymentGatewayAdapter {
    const adapter = this.adapters.find((candidate) =>
      candidate.supports(method),
    );

    if (!adapter) {
      throw PaymentDomainError.invalidMethod(method);
    }

    return adapter;
  }

  private getAdapterByReference(reference: string): PaymentGatewayAdapter {
    const normalizedReference = reference.toLowerCase();
    const method = normalizedReference.includes('orange')
      ? DomainPaymentMethod.ORANGE_MONEY
      : normalizedReference.includes('card')
        ? DomainPaymentMethod.CARD
        : DomainPaymentMethod.WAVE;

    return this.getAdapter(method);
  }
}
