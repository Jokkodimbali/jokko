import { type ConfigService } from '@nestjs/config';
import {
  type PaymentGatewayAdapter,
  type PaymentGatewayResponse,
  type PaymentMethod,
} from '../../application/ports/payment-gateway.port';
import {
  type ExternalPaymentRefundResponse,
  type ExternalPaymentVerifyResponse,
  toGatewayResponse,
} from './external-payment-gateway.types';

type InitiatePaymentParams = Parameters<
  PaymentGatewayAdapter['initiatePayment']
>[0];

type RefundPaymentParams = Parameters<
  PaymentGatewayAdapter['processRefund']
>[0];

export abstract class BaseHttpPaymentGatewayAdapter implements PaymentGatewayAdapter {
  protected abstract readonly providerName: string;
  protected abstract readonly supportedMethod: PaymentMethod;
  protected abstract readonly baseUrlEnvKey: string;
  protected abstract readonly apiKeyEnvKey: string;

  protected constructor(protected readonly configService: ConfigService) {}

  supports(method: PaymentMethod): boolean {
    return method === this.supportedMethod;
  }

  getSupportedMethods(): PaymentMethod[] {
    return [this.supportedMethod];
  }

  async initiatePayment(
    params: InitiatePaymentParams,
  ): Promise<PaymentGatewayResponse> {
    return this.request('/payments/initiate', {
      amount: params.amount,
      currency: params.currency,
      description: params.description,
      customerName: params.customerName,
      customerEmail: params.customerEmail,
      customerPhone: params.customerPhone,
      callbackUrl: params.callbackUrl,
      successUrl: params.successUrl,
      cancelUrl: params.cancelUrl,
      metadata: params.metadata,
      method: params.method,
    }).then(toGatewayResponse);
  }

  async verifyPayment(
    gatewayReference: string,
  ): Promise<PaymentGatewayResponse> {
    const response = await this.request<ExternalPaymentVerifyResponse>(
      `/payments/${gatewayReference}/verify`,
      {},
    );

    return {
      success: true,
      gatewayReference: response.reference ?? gatewayReference,
      data: response,
    };
  }

  async processRefund(
    params: RefundPaymentParams,
  ): Promise<PaymentGatewayResponse> {
    const response = await this.request<ExternalPaymentRefundResponse>(
      '/payments/refund',
      params,
    );

    return {
      success: Boolean(response.refunded ?? true),
      gatewayReference: response.reference ?? params.gatewayReference,
      data: response,
    };
  }

  private async request<TResponse extends Record<string, unknown>>(
    path: string,
    body: Record<string, unknown>,
  ): Promise<TResponse> {
    const baseUrl = this.configService.get<string>(this.baseUrlEnvKey);
    const apiKey = this.configService.get<string>(this.apiKeyEnvKey);

    if (!baseUrl || !apiKey) {
      return this.buildMissingConfigurationResponse() as TResponse;
    }

    const response = await fetch(`${baseUrl}${path}`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const json = (await response.json()) as TResponse;
    if (!response.ok) {
      return {
        ...json,
        success: false,
        error: `${this.providerName} a refuse la requete paiement.`,
      } as TResponse;
    }

    return json;
  }

  private buildMissingConfigurationResponse(): Record<string, unknown> {
    return {
      success: false,
      error: `${this.providerName} n'est pas configure.`,
    };
  }
}
