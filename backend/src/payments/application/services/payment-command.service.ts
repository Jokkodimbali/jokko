import { Injectable, Inject } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  type PaymentsRepository,
  PAYMENTS_REPOSITORY_PORT,
} from '../ports/payments-repository.port';
import {
  type PaymentGateway,
  PAYMENT_GATEWAY_PORT,
} from '../ports/payment-gateway.port';
import { Payment } from '../../domain/entities/payment.entity';
import { PaymentAmount } from '../../domain/value-objects/payment-amount.vo';
import { TransactionReference } from '../../domain/value-objects/transaction-reference.vo';
import {
  PaymentMethod,
  PaymentStatus,
} from '../../domain/value-objects/payment-types.vo';
import { PaymentDomainError } from '../../domain/errors/payment.domain-error';
import {
  DOMAIN_EVENT_DISPATCHER,
  type DomainEventDispatcher,
} from '../../../shared/domain/events/domain-event-dispatcher';

@Injectable()
export class PaymentCommandService {
  constructor(
    @Inject(PAYMENTS_REPOSITORY_PORT)
    private readonly paymentsRepository: PaymentsRepository,
    @Inject(PAYMENT_GATEWAY_PORT)
    private readonly paymentGateway: PaymentGateway,
    @Inject(DOMAIN_EVENT_DISPATCHER)
    private readonly domainEventDispatcher: DomainEventDispatcher,
  ) {}

  async initiatePayment(command: {
    bookingId: string;
    clientId: string;
    professionalId: string;
    amount: number;
    method: PaymentMethod;
    callbackUrl?: string;
    successUrl?: string;
    cancelUrl?: string;
  }): Promise<{
    payment: Payment;
    paymentUrl: string;
    gatewayReference: string;
  }> {
    const existingPayment = await this.paymentsRepository.findByBookingId(
      command.bookingId,
    );
    if (existingPayment) {
      throw PaymentDomainError.alreadyProcessed();
    }

    const paymentId = randomUUID();
    const payment = Payment.create({
      id: paymentId,
      bookingId: command.bookingId,
      clientId: command.clientId,
      professionalId: command.professionalId,
      method: command.method,
      amount: PaymentAmount.create(command.amount),
    });

    const transactionReference = TransactionReference.generate('PAY');
    payment.markAsProcessing(transactionReference);

    await this.paymentsRepository.save(payment);
    this.domainEventDispatcher.publishMany([...payment.getDomainEvents()]);
    payment.clearDomainEvents();

    const gatewayResponse = await this.paymentGateway.initiatePayment({
      amount: command.amount,
      currency: 'XOF', // FCFA
      description: `Paiement réservation ${command.bookingId}`, //
      customerName: command.clientId,
      customerPhone: command.clientId,
      callbackUrl: command.callbackUrl,
      successUrl: command.successUrl,
      cancelUrl: command.cancelUrl,
      metadata: {
        paymentId,
        bookingId: command.bookingId,
      },
      method: command.method,
    });

    if (
      !gatewayResponse.success ||
      !gatewayResponse.paymentUrl ||
      !gatewayResponse.gatewayReference
    ) {
      payment.markAsFailed('Erreur gateway inconnue');
      await this.paymentsRepository.save(payment);
      this.domainEventDispatcher.publishMany([...payment.getDomainEvents()]);
      payment.clearDomainEvents();
      throw PaymentDomainError.gatewayError(
        gatewayResponse.error
          ? String(gatewayResponse.error)
          : 'Erreur gateway inconnue',
      );
    }

    return {
      payment,
      paymentUrl: gatewayResponse.paymentUrl,
      gatewayReference: gatewayResponse.gatewayReference,
    };
  }

  async processPaymentWebhook(
    gatewayReference: string,
    status: PaymentStatus,
  ): Promise<Payment> {
    const payment =
      await this.paymentsRepository.findByTransactionReference(
        gatewayReference,
      );
    if (!payment) {
      throw PaymentDomainError.paymentNotFound(gatewayReference);
    }

    if (status === PaymentStatus.SUCCESS) {
      payment.markAsSuccess(gatewayReference);
    } else if (status === PaymentStatus.FAILED) {
      payment.markAsFailed('Payment failed');
    } else if (status === PaymentStatus.CANCELLED) {
      payment.markAsCancelled();
    }

    await this.paymentsRepository.save(payment);
    this.domainEventDispatcher.publishMany([...payment.getDomainEvents()]);
    payment.clearDomainEvents();

    return payment;
  }
}
