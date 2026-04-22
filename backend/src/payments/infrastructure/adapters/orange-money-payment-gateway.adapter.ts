import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PaymentMethod } from '../../domain/value-objects/payment-types.vo';
import { BaseHttpPaymentGatewayAdapter } from './base-http-payment-gateway.adapter';

@Injectable()
export class OrangeMoneyPaymentGatewayAdapter extends BaseHttpPaymentGatewayAdapter {
  protected readonly providerName = 'Orange Money';
  protected readonly supportedMethod = PaymentMethod.ORANGE_MONEY;
  protected readonly baseUrlEnvKey = 'ORANGE_MONEY_API_BASE_URL';
  protected readonly apiKeyEnvKey = 'ORANGE_MONEY_API_KEY';

  constructor(configService: ConfigService) {
    super(configService);
  }
}
