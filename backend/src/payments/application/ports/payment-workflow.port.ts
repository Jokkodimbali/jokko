import { type Payment } from '../../domain/entities/payment.entity';

export const PAYMENT_WORKFLOW_PORT = Symbol('PAYMENT_WORKFLOW_PORT');

export type PaymentReservationPaidWorkflowResult = {
  reservationId: string;
  clientId: string;
  professionalUserId: string;
  serviceName: string;
};

export interface PaymentWorkflowPort {
  markReservationAsPaid(
    payment: Payment,
  ): Promise<PaymentReservationPaidWorkflowResult | null>;
}
