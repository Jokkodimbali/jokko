import { type PaymentGatewayResponse } from '../../application/ports/payment-gateway.port';

export type ExternalPaymentInitResponse = {
  reference?: string;
  gatewayReference?: string;
  paymentUrl?: string;
  redirectUrl?: string;
  checkoutUrl?: string;
  status?: string;
};

export type ExternalPaymentVerifyResponse = {
  reference?: string;
  status?: string;
  amount?: number;
};

export type ExternalPaymentRefundResponse = {
  reference?: string;
  refunded?: boolean;
  status?: string;
};

export const toGatewayResponse = (
  response: ExternalPaymentInitResponse,
): PaymentGatewayResponse => {
  const gatewayReference = response.gatewayReference ?? response.reference;
  const paymentUrl =
    response.paymentUrl ?? response.redirectUrl ?? response.checkoutUrl;

  if (!gatewayReference || !paymentUrl) {
    return {
      success: false,
      error: 'Reponse provider paiement invalide.',
      data: response,
    };
  }

  return {
    success: true,
    gatewayReference,
    paymentUrl,
    data: response,
  };
};
