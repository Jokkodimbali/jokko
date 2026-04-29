import { type Payment } from '../../domain/entities/payment.entity';
import {
  type PaymentMethod,
  type PaymentStatus,
  type EscrowStatus,
} from '../../domain/value-objects/payment-types.vo';

export const PAYMENTS_REPOSITORY_PORT = Symbol('PAYMENTS_REPOSITORY_PORT');

export interface PaymentsRepository {
  save(payment: Payment): Promise<void>;
  findById(id: string): Promise<Payment | null>;
  findByBookingId(bookingId: string): Promise<Payment | null>;
  findByTransactionReference(reference: string): Promise<Payment | null>;
  findByClientId(
    clientId?: string,
    filters?: {
      status?: PaymentStatus;
      method?: PaymentMethod;
      limit?: number;
      offset?: number;
    },
  ): Promise<Payment[]>;
  findByProfessionalId(
    professionalId?: string,
    filters?: {
      status?: PaymentStatus;
      escrowStatus?: EscrowStatus;
      limit?: number;
      offset?: number;
    },
  ): Promise<Payment[]>;
  countByClientId(
    clientId?: string,
    filters?: {
      status?: PaymentStatus;
      method?: PaymentMethod;
    },
  ): Promise<number>;
  countByProfessionalId(
    professionalId?: string,
    filters?: {
      status?: PaymentStatus;
      escrowStatus?: EscrowStatus;
    },
  ): Promise<number>;
  updatePaymentStatus(
    id: string,
    status: PaymentStatus,
    gatewayReference?: string,
    processedAt?: Date,
  ): Promise<void>;
  updateEscrowStatus(
    id: string,
    escrowStatus: EscrowStatus,
    escrowReleasedAt?: Date,
    disputedAt?: Date,
  ): Promise<void>;
  findPendingEscrowReleases(): Promise<Payment[]>;
  findExpiredPayments(): Promise<Payment[]>;
  getAdminStatistics(): Promise<{
    totalPayments: number;
    totalRevenue: number;
    totalGrossAmount: number;
    pendingEscrowReleases: number;
    totalEscrowAmount: number;
  }>;
}
