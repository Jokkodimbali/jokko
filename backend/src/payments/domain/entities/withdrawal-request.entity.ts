import { type PaymentAmount } from '../value-objects/payment-amount.vo';
import { type WithdrawalStatus } from '../value-objects/payment-types.vo';

export type WithdrawalMethod = 'WAVE' | 'ORANGE_MONEY';

export type WithdrawalRequest = {
  id: string;
  professionalId: string;
  amount: PaymentAmount;
  method: WithdrawalMethod;
  status: WithdrawalStatus;
  requestedAt: Date;
  processedAt?: Date;
  gatewayReference?: string;
};
