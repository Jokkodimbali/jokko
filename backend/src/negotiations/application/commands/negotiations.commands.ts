import type { NegotiationStatus } from '../../domain';

export type CreateNegotiationCommand = {
  serviceId: string;
  proposedAmount: number;
  message?: string;
};

export type CounterNegotiationCommand = {
  proposedAmount: number;
  message?: string;
};

export type RejectNegotiationCommand = {
  reason?: string;
};

export type CancelNegotiationCommand = {
  reason?: string;
};

export type ListNegotiationsQuery = {
  scope?: 'CLIENT' | 'PRESTATAIRE';
  status?: NegotiationStatus;
  limit?: number;
  offset?: number;
};
