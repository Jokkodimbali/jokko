import { Injectable, Inject } from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import {
  type PaymentsRepository,
  PAYMENTS_REPOSITORY_PORT,
} from '../ports/payments-repository.port';
import {
  type PaymentGateway,
  PAYMENT_GATEWAY_PORT,
} from '../ports/payment-gateway.port';
import {
  type PaymentWorkflowPort,
  PAYMENT_WORKFLOW_PORT,
} from '../ports/payment-workflow.port';
import {
  type PaymentIdempotencyPort,
  PAYMENT_IDEMPOTENCY_PORT,
  type PaymentInitiationCache,
} from '../ports/payment-idempotency.port';
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
import { PaymentNotificationService } from '../../../notifications/application/services/payment-notification.service';
import {
  USERS_REPOSITORY_PORT,
  type UsersRepositoryPort,
} from '../../../users/application/ports/users-repository.port';

@Injectable()
export class PaymentCommandService {
  constructor(
    @Inject(PAYMENTS_REPOSITORY_PORT)
    private readonly paymentsRepository: PaymentsRepository,
    @Inject(PAYMENT_GATEWAY_PORT)
    private readonly paymentGateway: PaymentGateway,
    @Inject(PAYMENT_WORKFLOW_PORT)
    private readonly paymentWorkflow: PaymentWorkflowPort,
    @Inject(PAYMENT_IDEMPOTENCY_PORT)
    private readonly paymentIdempotency: PaymentIdempotencyPort,
    @Inject(DOMAIN_EVENT_DISPATCHER)
    private readonly domainEventDispatcher: DomainEventDispatcher,
    private readonly paymentNotificationService: PaymentNotificationService,
    @Inject(USERS_REPOSITORY_PORT)
    private readonly usersRepository: UsersRepositoryPort,
  ) {}

  async initiatePayment(command: {
    bookingId: string;
    clientId: string;
    professionalId: string;
    amount: number;
    commissionRate?: number;
    method: PaymentMethod;
    callbackUrl?: string;
    successUrl?: string;
    cancelUrl?: string;
    idempotencyKey?: string;
  }): Promise<{
    payment: Payment;
    paymentUrl: string;
    gatewayReference: string;
  }> {
    const idempotencyKey = command.idempotencyKey?.trim();
    if (!idempotencyKey) {
      throw PaymentDomainError.idempotencyKeyRequired();
    }

    const requestHash = this.buildInitiationRequestHash(command);
    const existingIdempotency =
      await this.paymentIdempotency.findByKey(idempotencyKey);

    if (existingIdempotency) {
      if (existingIdempotency.requestHash !== requestHash) {
        throw PaymentDomainError.idempotencyConflict();
      }

      if (
        existingIdempotency.status === 'TERMINE' &&
        existingIdempotency.response
      ) {
        const payment = await this.paymentsRepository.findById(
          existingIdempotency.response.paymentId,
        );
        if (!payment) {
          throw PaymentDomainError.paymentNotFound(
            existingIdempotency.response.paymentId,
          );
        }

        return {
          payment,
          paymentUrl: existingIdempotency.response.paymentUrl,
          gatewayReference: existingIdempotency.response.gatewayReference,
        };
      }

      throw PaymentDomainError.idempotencyInProgress();
    }

    await this.paymentIdempotency.createInProgress({
      key: idempotencyKey,
      scope: `payments:initiate:${command.clientId}`,
      requestHash,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });

    const existingPayment = await this.paymentsRepository.findByBookingId(
      command.bookingId,
    );
    if (existingPayment) {
      await this.paymentIdempotency.fail(idempotencyKey);
      throw PaymentDomainError.alreadyProcessed();
    }

    const paymentId = randomUUID();
    const client = await this.usersRepository.findMeById(command.clientId);
    if (!client) {
      await this.paymentIdempotency.fail(idempotencyKey);
      throw PaymentDomainError.unauthorizedAccess(command.clientId);
    }

    const payment = Payment.create({
      id: paymentId,
      bookingId: command.bookingId,
      clientId: command.clientId,
      professionalId: command.professionalId,
      method: command.method,
      amount: PaymentAmount.create(command.amount),
      commissionRate: command.commissionRate,
    });

    const transactionReference = TransactionReference.generate('PAY');
    payment.markAsProcessing(transactionReference);

    await this.paymentsRepository.save(payment);
    this.domainEventDispatcher.publishMany([...payment.getDomainEvents()]);
    payment.clearDomainEvents();

    const gatewayResponse = await this.paymentGateway.initiatePayment({
      amount: command.amount,
      currency: 'XOF', // FCFA
      description: `Paiement reservation ${command.bookingId}`,
      customerName: client.nom,
      customerEmail: client.email ?? undefined,
      customerPhone: client.numeroTelephone,
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
      payment.markAsFailed(PaymentDomainError.gatewayUnknownError().message);
      await this.paymentsRepository.save(payment);
      await this.paymentIdempotency.fail(idempotencyKey);
      this.domainEventDispatcher.publishMany([...payment.getDomainEvents()]);
      payment.clearDomainEvents();
      throw gatewayResponse.error
        ? PaymentDomainError.gatewayError(String(gatewayResponse.error))
        : PaymentDomainError.gatewayUnknownError();
    }

    payment.attachGatewayReference(gatewayResponse.gatewayReference);
    await this.paymentsRepository.save(payment);

    const response: PaymentInitiationCache = {
      paymentId: payment.id,
      paymentUrl: gatewayResponse.paymentUrl,
      gatewayReference: gatewayResponse.gatewayReference,
    };

    await this.paymentIdempotency.complete(idempotencyKey, response);

    return {
      payment,
      paymentUrl: response.paymentUrl,
      gatewayReference: response.gatewayReference,
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

    const wasAlreadySuccessful = payment.isSuccessful();

    if (status === PaymentStatus.SUCCESS) {
      payment.markAsSuccess(gatewayReference);
    } else if (status === PaymentStatus.FAILED) {
      payment.markAsFailed(PaymentDomainError.failedByProvider().message);
    } else if (status === PaymentStatus.CANCELLED) {
      payment.markAsCancelled();
    }

    await this.paymentsRepository.save(payment);
    if (payment.isSuccessful() && !wasAlreadySuccessful) {
      const workflowResult =
        await this.paymentWorkflow.markReservationAsPaid(payment);
      if (workflowResult) {
        await this.paymentNotificationService.notifyEscrowConfirmed({
          clientId: workflowResult.clientId,
          professionalUserId: workflowResult.professionalUserId,
          reservationId: workflowResult.reservationId,
          paymentId: payment.id,
          serviceName: workflowResult.serviceName,
          amount: payment.amount.getValue(),
          escrowStatus: payment.escrowStatus,
        });
      }
    }
    this.domainEventDispatcher.publishMany([...payment.getDomainEvents()]);
    payment.clearDomainEvents();

    return payment;
  }

  private buildInitiationRequestHash(command: {
    bookingId: string;
    clientId: string;
    professionalId: string;
    amount: number;
    method: PaymentMethod;
  }): string {
    return createHash('sha256')
      .update(
        JSON.stringify({
          bookingId: command.bookingId,
          clientId: command.clientId,
          professionalId: command.professionalId,
          amount: command.amount,
          method: command.method,
        }),
      )
      .digest('hex');
  }
}
