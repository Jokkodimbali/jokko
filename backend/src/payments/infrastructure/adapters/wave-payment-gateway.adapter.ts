import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac } from 'node:crypto';
import type { PaymentGatewayAdapter, PaymentGatewayResponse } from '../../application/ports/payment-gateway.port';
import { PaymentMethod } from '../../domain/value-objects/payment-types.vo';

@Injectable()
export class WavePaymentGatewayAdapter implements PaymentGatewayAdapter {
  constructor(private readonly configService: ConfigService) {}

  supports(method: PaymentMethod): boolean { return method === PaymentMethod.WAVE; }
  getSupportedMethods(): PaymentMethod[] { return [PaymentMethod.WAVE]; }

  async initiatePayment(params: Parameters<PaymentGatewayAdapter['initiatePayment']>[0]): Promise<PaymentGatewayResponse> {
    if (!Number.isSafeInteger(params.amount) || params.amount <= 0 || params.currency !== 'XOF' ||
      !this.isHttpsUrl(params.successUrl) || !this.isHttpsUrl(params.cancelUrl)) {
      return { success: false, error: 'WAVE_CHECKOUT_PARAMETERS_INVALID' };
    }
    const response = await this.request('POST', '/v1/checkout/sessions', {
      amount: String(params.amount),
      currency: 'XOF',
      success_url: params.successUrl,
      error_url: params.cancelUrl,
      ...(typeof params.metadata?.['paymentId'] === 'string'
        ? { client_reference: params.metadata['paymentId'] }
        : {}),
    });
    if (!response.ok || !response.body || typeof response.body['id'] !== 'string' ||
      !this.isCheckoutReference(response.body['id']) ||
      typeof response.body['wave_launch_url'] !== 'string' ||
      !this.isHttpsUrl(response.body['wave_launch_url'])) {
      return { success: false, error: response.error ?? 'WAVE_CHECKOUT_INITIATION_FAILED' };
    }
    return { success: true, gatewayReference: response.body['id'], paymentUrl: response.body['wave_launch_url'], data: response.body };
  }

  async verifyPayment(gatewayReference: string): Promise<PaymentGatewayResponse> {
    if (!this.isCheckoutReference(gatewayReference)) return { success: false, error: 'WAVE_CHECKOUT_REFERENCE_INVALID' };
    const response = await this.request('GET', `/v1/checkout/sessions/${encodeURIComponent(gatewayReference)}`);
    if (!response.ok || !response.body || response.body['id'] !== gatewayReference) {
      return { success: false, error: response.error ?? 'WAVE_CHECKOUT_VERIFICATION_FAILED' };
    }
    return { success: true, gatewayReference, data: response.body };
  }

  async processRefund(params: Parameters<PaymentGatewayAdapter['processRefund']>[0]): Promise<PaymentGatewayResponse> {
    if (!this.isCheckoutReference(params.gatewayReference) || !Number.isSafeInteger(params.amount) || params.amount <= 0) {
      return { success: false, error: 'WAVE_REFUND_PARAMETERS_INVALID' };
    }
    const checkout = await this.verifyPayment(params.gatewayReference);
    if (!checkout.success || checkout.data?.['payment_status'] !== 'succeeded' ||
      checkout.data?.['currency'] !== 'XOF' || Number(checkout.data?.['amount']) !== params.amount) {
      return { success: false, error: 'WAVE_REFUND_CHECKOUT_NOT_PAID_OR_AMOUNT_MISMATCH' };
    }
    const response = await this.request('POST', `/v1/checkout/sessions/${encodeURIComponent(params.gatewayReference)}/refund`);
    // Wave returns HTTP 200 with an empty body. The operation is idempotent for this checkout.
    return response.ok && response.status === 200
      ? { success: true, gatewayReference: params.gatewayReference, data: { refunded: true } }
      : { success: false, error: response.error ?? 'WAVE_REFUND_PROVIDER_REJECTED' };
  }

  private isCheckoutReference(reference: string): boolean {
    return /^cos-[a-zA-Z0-9-]+$/.test(reference);
  }

  private isHttpsUrl(value?: string): boolean {
    if (!value) return false;
    try { return new URL(value).protocol === 'https:'; } catch { return false; }
  }

  private async request(method: 'GET' | 'POST', path: string, payload?: Record<string, unknown>): Promise<{
    ok: boolean; status: number; body?: Record<string, unknown>; error?: string;
  }> {
    const key = this.configService.get<string>('WAVE_API_KEY');
    if (!key) return { ok: false, status: 0, error: 'WAVE_API_KEY_MISSING' };
    const baseUrl = this.configService.get<string>('WAVE_API_BASE_URL') || 'https://api.wave.com';
    if (!this.isHttpsUrl(baseUrl)) return { ok: false, status: 0, error: 'WAVE_API_BASE_URL_INVALID' };
    const body = payload ? JSON.stringify(payload) : '';
    const headers: Record<string, string> = { Authorization: `Bearer ${key}` };
    if (payload) headers['Content-Type'] = 'application/json';
    const signingSecret = this.configService.get<string>('WAVE_API_SIGNING_SECRET');
    if (signingSecret) {
      const timestamp = Math.floor(Date.now() / 1000);
      const signature = createHmac('sha256', signingSecret).update(`${timestamp}${body}`).digest('hex');
      headers['Wave-Signature'] = `t=${timestamp},v1=${signature}`;
    }
    try {
      const response = await fetch(`${baseUrl.replace(/\/$/, '')}${path}`, {
        method, headers, ...(payload ? { body } : {}), signal: AbortSignal.timeout(10_000),
      });
      if (!response.ok) return { ok: false, status: response.status, error: `WAVE_HTTP_${response.status}` };
      const raw = await response.text();
      if (!raw) return { ok: true, status: response.status };
      try { return { ok: true, status: response.status, body: JSON.parse(raw) as Record<string, unknown> }; }
      catch { return { ok: false, status: response.status, error: 'WAVE_RESPONSE_INVALID' }; }
    } catch {
      return { ok: false, status: 0, error: 'WAVE_NETWORK_UNAVAILABLE' };
    }
  }
}
