import { Injectable, Inject } from '@nestjs/common';
import {
  type PaymentsRepository,
  PAYMENTS_REPOSITORY_PORT,
} from '../ports/payments-repository.port';
import { Payment } from '../../domain/entities/payment.entity';
import {
  type PaymentMethod,
  type PaymentStatus,
  type EscrowStatus,
} from '../../domain/value-objects/payment-types.vo';
import { PaymentDomainError } from '../../domain/errors/payment.domain-error';

@Injectable()
export class PaymentQueryService {
  constructor(
    @Inject(PAYMENTS_REPOSITORY_PORT)
    private readonly paymentsRepository: PaymentsRepository,
  ) {}

  async getPaymentById(paymentId: string): Promise<Payment> {
    const payment = await this.paymentsRepository.findById(paymentId);
    if (!payment) {
      throw PaymentDomainError.paymentNotFound(paymentId);
    }
    return payment;
  }

  async getPaymentByBookingId(bookingId: string): Promise<Payment | null> {
    return this.paymentsRepository.findByBookingId(bookingId);
  }

  async getClientPaymentHistory(
    clientId?: string,
    filters?: {
      status?: PaymentStatus;
      method?: PaymentMethod;
      limit?: number;
      offset?: number;
    },
  ): Promise<{ payments: Payment[]; total: number }> {
    const payments = await this.paymentsRepository.findByClientId(
      clientId,
      filters,
    );
    const total = await this.paymentsRepository.countByClientId(
      clientId,
      filters,
    );

    return { payments, total };
  }

  async getProfessionalPaymentHistory(
    professionalId?: string,
    filters?: {
      status?: PaymentStatus;
      escrowStatus?: EscrowStatus;
      limit?: number;
      offset?: number;
    },
  ): Promise<{ payments: Payment[]; total: number }> {
    const payments = await this.paymentsRepository.findByProfessionalId(
      professionalId,
      filters,
    );
    const total = await this.paymentsRepository.countByProfessionalId(
      professionalId,
      filters,
    );

    return { payments, total };
  }

  async getAdminStatistics() {
    return this.paymentsRepository.getAdminStatistics();
  }
}
