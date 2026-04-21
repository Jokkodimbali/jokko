import { type WithdrawalRequest } from '../services/withdrawal.service';

export const WITHDRAWALS_REPOSITORY_PORT = Symbol(
  'WITHDRAWALS_REPOSITORY_PORT',
);

export interface WithdrawalsRepository {
  save(withdrawal: WithdrawalRequest): Promise<void>;
  updateStatus(
    id: string,
    status: string,
    processedAt?: Date,
    gatewayReference?: string,
  ): Promise<void>;
  findById(id: string): Promise<WithdrawalRequest | null>;
  findByProfessionalId(professionalId: string): Promise<WithdrawalRequest[]>;
  findPending(): Promise<WithdrawalRequest[]>;
}
