import { Injectable, Inject } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PaymentAmount } from '../../domain/value-objects/payment-amount.vo';
import { PaymentDomainError } from '../../domain/errors/payment.domain-error';
import {
  DOMAIN_EVENT_DISPATCHER,
  type DomainEventDispatcher,
} from '../../../shared/domain/events/domain-event-dispatcher';
import {
  WithdrawalRequestedEvent,
  WithdrawalCompletedEvent,
} from '../../domain/events/payment.events';
import {
  WITHDRAWALS_REPOSITORY_PORT,
  type WithdrawalsRepository,
} from '../ports/withdrawals-repository.port';
import {
  WALLET_LEDGER_PORT,
  type WalletLedgerPort,
} from '../ports/wallet-ledger.port';
import { type WithdrawalRequest } from '../../domain/entities/withdrawal-request.entity';
import { WithdrawalStatus } from '../../domain/value-objects/payment-types.vo';
import { NotificationsService } from '../../../notifications/application/services/notifications.service';
import { NOTIFICATION_TYPES } from '../../../notifications/domain/entities/notification.entity';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class WithdrawalService {
  constructor(
    @Inject(WITHDRAWALS_REPOSITORY_PORT)
    private readonly withdrawalsRepository: WithdrawalsRepository,
    @Inject(WALLET_LEDGER_PORT)
    private readonly walletLedger: WalletLedgerPort,
    @Inject(DOMAIN_EVENT_DISPATCHER)
    private readonly domainEventDispatcher: DomainEventDispatcher,
    private readonly notificationsService: NotificationsService,
    private readonly prisma: PrismaService,
  ) {}

  async requestWithdrawal(params: {
    professionalId: string;
    amount: number;
    method: 'WAVE' | 'ORANGE_MONEY';
  }): Promise<WithdrawalRequest> {
    const { professionalId, amount, method } = params;
    const walletBalance =
      await this.calculateAvailableWalletBalance(professionalId);

    if (amount < 2000) {
      throw PaymentDomainError.withdrawalAmountTooLow(2000, amount);
    }

    if (amount > 500000) {
      throw PaymentDomainError.withdrawalAmountTooHigh(500000, amount);
    }

    if (amount > walletBalance) {
      throw PaymentDomainError.insufficientFunds(amount, walletBalance);
    }

    const created: WithdrawalRequest = {
      id: randomUUID(),
      professionalId,
      amount: PaymentAmount.create(amount),
      method,
      status: WithdrawalStatus.PENDING,
      requestedAt: new Date(),
    };

    await this.withdrawalsRepository.save(created);

    this.domainEventDispatcher.publish(
      new WithdrawalRequestedEvent(created.id, professionalId, amount, method),
    );

    return this.processWithdrawal(created.id);
  }

  async processWithdrawal(withdrawalId: string): Promise<WithdrawalRequest> {
    const withdrawal = await this.withdrawalsRepository.findById(withdrawalId);
    if (!withdrawal) {
      throw PaymentDomainError.withdrawalNotFound(withdrawalId);
    }

    if (withdrawal.status !== WithdrawalStatus.PENDING) {
      throw PaymentDomainError.withdrawalAlreadyProcessed(withdrawal.status);
    }

    const professional =
      await this.prisma.profilProfessionnel.findUniqueOrThrow({
        where: { id: withdrawal.professionalId },
        select: { utilisateurId: true },
      });

    const processedAt = new Date();
    const gatewayReference = `GW_${Date.now()}`;

    await this.walletLedger.debitWithdrawal({
      professionalId: withdrawal.professionalId,
      amount: withdrawal.amount.getValue(),
      withdrawalId,
      processedAt,
      gatewayReference,
    });

    this.domainEventDispatcher.publish(
      new WithdrawalCompletedEvent(
        withdrawalId,
        withdrawal.professionalId,
        withdrawal.amount.getValue(),
      ),
    );

    const amount = withdrawal.amount.getValue();
    await this.notificationsService.createInAppNotification({
      userId: professional.utilisateurId,
      type: NOTIFICATION_TYPES.RETRAIT_EFFECTUE,
      title: 'Retrait effectué',
      body: `${amount.toLocaleString('fr-FR')} FCFA ont été retirés de votre portefeuille vers ${withdrawal.method === 'WAVE' ? 'Wave' : 'Orange Money'}.`,
      data: {
        withdrawalId,
        amount,
        method: withdrawal.method,
        walletDebit: true,
      },
    });

    const processedWithdrawal =
      await this.withdrawalsRepository.findById(withdrawalId);
    if (!processedWithdrawal) {
      throw PaymentDomainError.withdrawalNotFound(withdrawalId);
    }

    return processedWithdrawal;
  }

  async getProfessionalWithdrawals(
    professionalId: string,
  ): Promise<WithdrawalRequest[]> {
    return this.withdrawalsRepository.findByProfessionalId(professionalId);
  }

  private async calculateAvailableWalletBalance(
    professionalId: string,
  ): Promise<number> {
    return this.walletLedger.getAvailableBalance(professionalId);
  }
}
