import { ConfigService } from '@nestjs/config';
import { PaymentMethod } from '../../domain/value-objects/payment-types.vo';
import { WavePaymentGatewayAdapter } from './wave-payment-gateway.adapter';

describe('WavePaymentGatewayAdapter', () => {
  const originalFetch = global.fetch;
  const config = { get: jest.fn((key: string) => key === 'WAVE_API_KEY' ? 'test-key' : undefined) };
  let adapter: WavePaymentGatewayAdapter;

  beforeEach(() => {
    config.get.mockClear();
    adapter = new WavePaymentGatewayAdapter(config as unknown as ConfigService);
  });

  afterEach(() => { global.fetch = originalFetch; });

  it('creates a Wave checkout with a real HTTPS return and payment reference', async () => {
    const fetchMock = jest.fn().mockResolvedValue(new Response(JSON.stringify({
      id: 'cos-test123', wave_launch_url: 'https://pay.wave.com/test',
    }), { status: 200 }));
    global.fetch = fetchMock;
    const result = await adapter.initiatePayment({
      amount: 9000, currency: 'XOF', method: PaymentMethod.WAVE,
      successUrl: 'https://jokko.example/pay?paymentReturn=1',
      cancelUrl: 'https://jokko.example/pay',
      metadata: { paymentId: 'payment-1' },
    } as Parameters<typeof adapter.initiatePayment>[0]);
    expect(result).toMatchObject({ success: true, gatewayReference: 'cos-test123' });
    expect(fetchMock).toHaveBeenCalledWith('https://api.wave.com/v1/checkout/sessions',
      expect.objectContaining({ method: 'POST', body: expect.stringContaining('"client_reference":"payment-1"') }));
  });

  it('accepts only a provider-confirmed full refund', async () => {
    global.fetch = jest.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        id: 'cos-test123', payment_status: 'succeeded', currency: 'XOF', amount: '9000',
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response(null, { status: 200 }));
    await expect(adapter.processRefund({ gatewayReference: 'cos-test123', amount: 9000,
      method: PaymentMethod.WAVE, reason: 'Annulation', idempotencyKey: 'refund-1',
    })).resolves.toMatchObject({ success: true, data: { refunded: true } });
  });

  it('does not refund if the checkout amount differs', async () => {
    const fetchMock = jest.fn().mockResolvedValue(new Response(JSON.stringify({
      id: 'cos-test123', payment_status: 'succeeded', currency: 'XOF', amount: '8000',
    }), { status: 200 }));
    global.fetch = fetchMock;
    const result = await adapter.processRefund({ gatewayReference: 'cos-test123', amount: 9000,
      method: PaymentMethod.WAVE, reason: 'Annulation', idempotencyKey: 'refund-1',
    });
    expect(result.success).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('does not treat a provider error as a refund', async () => {
    global.fetch = jest.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({
        id: 'cos-test123', payment_status: 'succeeded', currency: 'XOF', amount: '9000',
      }), { status: 200 }))
      .mockResolvedValueOnce(new Response('{}', { status: 503 }));
    const result = await adapter.processRefund({ gatewayReference: 'cos-test123', amount: 9000,
      method: PaymentMethod.WAVE, reason: 'Annulation', idempotencyKey: 'refund-1',
    });
    expect(result.success).toBe(false);
  });
});
