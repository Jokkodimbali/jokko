import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PaymentMethod } from '../../domain/value-objects/payment-types.vo';
import { BaseHttpPaymentGatewayAdapter } from './base-http-payment-gateway.adapter';

@Injectable()
export class WavePaymentGatewayAdapter extends BaseHttpPaymentGatewayAdapter {
  protected readonly providerName = 'Wave';
  protected readonly supportedMethod = PaymentMethod.WAVE;
  protected readonly baseUrlEnvKey = 'WAVE_API_BASE_URL';
  protected readonly apiKeyEnvKey = 'WAVE_API_KEY';

  constructor(configService: ConfigService) {
    super(configService);
  }
}
