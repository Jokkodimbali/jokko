import { Injectable, Inject, Optional } from '@nestjs/common';
import {
  PAYMENTS_REPOSITORY_PORT,
  type PaymentsRepository,
} from '../ports/payments-repository.port';
import { Payment } from '../../domain/entities/payment.entity';
import { PaymentDomainError } from '../../domain/errors/payment.domain-error';
import {
  DOMAIN_EVENT_DISPATCHER,
  type DomainEventDispatcher,
} from '../../../shared/domain/events/domain-event-dispatcher';
import {
  WALLET_LEDGER_PORT,
  type WalletLedgerPort,
} from '../ports/wallet-ledger.port';
import { NotificationsService } from '../../../notifications/application/services/notifications.service';
import { NOTIFICATION_TYPES } from '../../../notifications/domain/entities/notification.entity';

@Injectable()
export class EscrowService {
  constructor(
    @Inject(PAYMENTS_REPOSITORY_PORT)
    private readonly paymentsRepository: PaymentsRepository,
    @Inject(DOMAIN_EVENT_DISPATCHER)
    private readonly domainEventDispatcher: DomainEventDispatcher,
    @Inject(WALLET_LEDGER_PORT)
    private readonly walletLedger: WalletLedgerPort,
    @Optional() private readonly notificationsService?: NotificationsService,
  ) {}

  async releaseEscrow(paymentId: string): Promise<Payment> {
    const payment = await this.paymentsRepository.findById(paymentId);
    if (!payment) {
      throw PaymentDomainError.escrowNotFound(paymentId);
    }

    if (!payment.canReleaseEscrow()) {
      throw PaymentDomainError.escrowAlreadyReleased();
    }

    payment.releaseEscrow();
    await this.walletLedger.creditReleasedEscrow(payment);
    this.domainEventDispatcher.publishMany([...payment.getDomainEvents()]);
    payment.clearDomainEvents();

    if (this.notificationsService) {
      await this.notificationsService.createManyInAppNotifications([
        {
          userId: payment.clientId,
          type: NOTIFICATION_TYPES.PAIEMENT_LIBERE,
          title: 'Paiement libere',
          body: 'Le paiement securise de votre prestation a ete libere.',
          data: { paymentId: payment.id, reservationId: payment.bookingId },
        },
        {
          userId: payment.professionalId,
          type: NOTIFICATION_TYPES.PAIEMENT_LIBERE,
          title: 'Paiement recu',
          body: 'Le paiement de la prestation a ete credite dans votre portefeuille.',
          data: { paymentId: payment.id, reservationId: payment.bookingId },
        },
      ]);
    }

    return payment;
  }

  async disputeEscrow(paymentId: string, reason?: string): Promise<Payment> {
    const payment = await this.paymentsRepository.findById(paymentId);
    if (!payment) {
      throw PaymentDomainError.escrowNotFound(paymentId);
    }

    if (!payment.isEscrowLocked()) {
      throw PaymentDomainError.escrowAlreadyDisputed();
    }

    payment.disputeEscrow(reason);
    await this.paymentsRepository.save(payment);
    this.domainEventDispatcher.publishMany([...payment.getDomainEvents()]);
    payment.clearDomainEvents();

    return payment;
  }

  async refundPayment(paymentId: string, reason?: string): Promise<Payment> {
    const payment = await this.paymentsRepository.findById(paymentId);
    if (!payment) {
      throw PaymentDomainError.escrowNotFound(paymentId);
    }

    if (!payment.canBeRefunded()) {
      throw PaymentDomainError.escrowAlreadyReleased();
    }

    payment.refund(reason);
    await this.paymentsRepository.save(payment);
    this.domainEventDispatcher.publishMany([...payment.getDomainEvents()]);
    payment.clearDomainEvents();

    return payment;
  }

  async getPendingEscrowReleases(): Promise<Payment[]> {
    return this.paymentsRepository.findPendingEscrowReleases();
  }

  async processAutomaticEscrowRelease(paymentId: string): Promise<Payment> {
    return this.releaseEscrow(paymentId);
  }

  async getEscrowStatus(paymentId: string): Promise<{
    isLocked: boolean;
    isReleased: boolean;
    isDisputed: boolean;
    releasedAt?: Date;
    disputedAt?: Date;
  }> {
    const payment = await this.paymentsRepository.findById(paymentId);
    if (!payment) {
      throw PaymentDomainError.escrowNotFound(paymentId);
    }

    return {
      isLocked: payment.isEscrowLocked(),
      isReleased: payment.isEscrowReleased(),
      isDisputed: payment.isEscrowDisputed(),
      releasedAt: payment.escrowReleasedAt || undefined,
      disputedAt: payment.disputedAt || undefined,
    };
  }
}
