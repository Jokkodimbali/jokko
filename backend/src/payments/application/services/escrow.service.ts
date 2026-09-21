import { Injectable, Inject } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
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
import { PrismaService } from '../../../prisma/prisma.service';
import { ServiceCompletedEvent } from '../../../reservations/domain/events/reservation-mission.events';

@Injectable()
export class EscrowService {
  constructor(
    @Inject(PAYMENTS_REPOSITORY_PORT)
    private readonly paymentsRepository: PaymentsRepository,
    @Inject(DOMAIN_EVENT_DISPATCHER)
    private readonly domainEventDispatcher: DomainEventDispatcher,
    @Inject(WALLET_LEDGER_PORT)
    private readonly walletLedger: WalletLedgerPort,
    private readonly notificationsService: NotificationsService,
    private readonly prisma: PrismaService,
  ) {}

  @OnEvent('tracking.service.completed')
  async releaseCompletedReservationEscrow(
    event: ServiceCompletedEvent,
  ): Promise<void> {
    const payment = await this.paymentsRepository.findByBookingId(
      event.payload.reservationId,
    );

    // A completion event can be replayed. The escrow state makes this safe and
    // ensures the wallet notification is emitted only after the real credit.
    if (!payment?.canReleaseEscrow()) {
      return;
    }

    await this.releaseEscrow(payment.id);
  }

  async releaseEscrow(paymentId: string): Promise<Payment> {
    const payment = await this.paymentsRepository.findById(paymentId);
    if (!payment) {
      throw PaymentDomainError.escrowNotFound(paymentId);
    }

    if (!payment.canReleaseEscrow()) {
      throw PaymentDomainError.escrowAlreadyReleased();
    }

    const professional =
      await this.prisma.profilProfessionnel.findUniqueOrThrow({
        where: { id: payment.professionalId },
        select: { utilisateurId: true },
      });

    payment.releaseEscrow();
    await this.walletLedger.creditReleasedEscrow(payment);
    this.domainEventDispatcher.publishMany([...payment.getDomainEvents()]);
    payment.clearDomainEvents();

    const reservation = await this.prisma.reservation.findUnique({
      where: { id: payment.bookingId },
      select: { service: { select: { nom: true } } },
    });
    const serviceName = reservation?.service.nom;
    await this.notificationsService.createManyInAppNotifications([
      {
        userId: payment.clientId,
        type: NOTIFICATION_TYPES.PAIEMENT_LIBERE,
        title: 'Paiement libéré',
        body: 'Le paiement sécurisé de votre prestation a été libéré.',
        data: {
          paymentId: payment.id,
          reservationId: payment.bookingId,
          serviceName,
        },
      },
      {
        userId: professional.utilisateurId,
        type: NOTIFICATION_TYPES.PAIEMENT_LIBERE,
        title: 'Paiement reçu',
        body: 'Le paiement de la prestation a été crédité dans votre portefeuille.',
        data: {
          paymentId: payment.id,
          reservationId: payment.bookingId,
          amount: payment.netAmount.getValue(),
          walletCredit: true,
          serviceName,
        },
      },
    ]);

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
