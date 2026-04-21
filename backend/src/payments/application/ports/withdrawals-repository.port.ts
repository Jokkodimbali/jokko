import { type WithdrawalRequest } from '../../domain/entities/withdrawal-request.entity';
import { type WithdrawalStatus } from '../../domain/value-objects/payment-types.vo';

export const WITHDRAWALS_REPOSITORY_PORT = Symbol(
  'WITHDRAWALS_REPOSITORY_PORT',
);

export interface WithdrawalsRepository {
  save(withdrawal: WithdrawalRequest): Promise<void>;
  updateStatus(
    id: string,
    status: WithdrawalStatus,
    processedAt?: Date,
    gatewayReference?: string,
  ): Promise<void>;
  findById(id: string): Promise<WithdrawalRequest | null>;
  findByProfessionalId(professionalId: string): Promise<WithdrawalRequest[]>;
  findPending(): Promise<WithdrawalRequest[]>;
}
