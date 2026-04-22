import { type Payment } from '../../domain/entities/payment.entity';

export const WALLET_LEDGER_PORT = Symbol('WALLET_LEDGER_PORT');

export interface WalletLedgerPort {
  getAvailableBalance(professionalId: string): Promise<number>;
  creditReleasedEscrow(payment: Payment): Promise<void>;
  debitWithdrawal(params: {
    professionalId: string;
    amount: number;
    withdrawalId: string;
    processedAt: Date;
    gatewayReference: string;
  }): Promise<void>;
}
