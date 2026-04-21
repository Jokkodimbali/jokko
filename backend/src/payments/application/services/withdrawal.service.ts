import { Injectable, Inject } from '@nestjs/common';
import { PaymentAmount } from '../../domain/value-objects/payment-amount.vo';
import { PaymentDomainError } from '../../domain/errors/payment.domain-error';
import {
  DOMAIN_EVENT_DISPATCHER,
  DomainEventDispatcher,
} from '../../../shared/domain/events/domain-event-dispatcher';
import {
  WithdrawalRequestedEvent,
  WithdrawalCompletedEvent,
} from '../../domain/events/payment.events';
import {
  WITHDRAWALS_REPOSITORY_PORT,
  type WithdrawalsRepository,
} from '../ports/withdrawals-repository.port';
import { randomUUID } from 'node:crypto';

export interface WithdrawalRequest {
  id: string;
  professionalId: string;
  amount: PaymentAmount;
  method: 'WAVE' | 'ORANGE_MONEY' | 'CARTE';
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  requestedAt: Date;
  processedAt?: Date;
  gatewayReference?: string;
}

@Injectable()
export class WithdrawalService {
  constructor(
    @Inject(WITHDRAWALS_REPOSITORY_PORT)
    private readonly withdrawalsRepository: WithdrawalsRepository,
    @Inject(DOMAIN_EVENT_DISPATCHER)
    private readonly domainEventDispatcher: DomainEventDispatcher,
  ) {}

  async requestWithdrawal(params: {
    professionalId: string;
    amount: number;
    method: 'WAVE' | 'ORANGE_MONEY';
    walletBalance: number;
  }): Promise<WithdrawalRequest> {
    const { professionalId, amount, method, walletBalance } = params;

    if (amount < 2000) {
      throw PaymentDomainError.withdrawalAmountTooLow(2000, amount);
    }

    if (amount > 500000) {
      throw PaymentDomainError.withdrawalAmountTooHigh(500000, amount);
    }

    if (amount > walletBalance) {
      throw PaymentDomainError.insufficientFunds(amount, walletBalance);
    }

    const withdrawalId = randomUUID();
    const created: WithdrawalRequest = {
      id: withdrawalId,
      professionalId,
      amount: PaymentAmount.create(amount),
      method,
      status: 'PENDING',
      requestedAt: new Date(),
    };

    await this.withdrawalsRepository.save(created);

    this.domainEventDispatcher.publish(
      new WithdrawalRequestedEvent(created.id, professionalId, amount, method),
    );

    await this.processWithdrawal(created.id);

    return created;
  }

  async processWithdrawal(withdrawalId: string): Promise<WithdrawalRequest> {
    const withdrawalDto =
      await this.withdrawalsRepository.findById(withdrawalId);
    if (!withdrawalDto) {
      throw PaymentDomainError.withdrawalNotFound(withdrawalId);
    }

    if (withdrawalDto.status !== 'PENDING') {
      throw PaymentDomainError.withdrawalAlreadyProcessed(withdrawalDto.status);
    }

    await this.withdrawalsRepository.updateStatus(withdrawalId, 'PROCESSING');

    setTimeout(async () => {
      const now = new Date();
      const gatewayRef = `GW_\${Date.now()}`;
      await this.withdrawalsRepository.updateStatus(
        withdrawalId,
        'COMPLETED',
        now,
        gatewayRef,
      );

      this.domainEventDispatcher.publish(
        new WithdrawalCompletedEvent(
          withdrawalId,
          withdrawalDto.professionalId,
          withdrawalDto.amount.getValue(),
        ),
      );
    }, 2000);

    return (await this.withdrawalsRepository.findById(withdrawalId))!;
  }

  async getWithdrawalStatus(
    withdrawalId: string,
  ): Promise<WithdrawalRequest | null> {
    return this.withdrawalsRepository.findById(withdrawalId);
  }

  async getProfessionalWithdrawals(
    professionalId: string,
  ): Promise<WithdrawalRequest[]> {
    return this.withdrawalsRepository.findByProfessionalId(professionalId);
  }

  calculateWithdrawalFee(): number {
    return 0;
  }

  isWithdrawalAllowed(professionalId: string, amount: number): boolean {
    return amount >= 2000 && amount <= 500000;
  }
}
