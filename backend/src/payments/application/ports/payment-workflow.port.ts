import { type Payment } from '../../domain/entities/payment.entity';

export const PAYMENT_WORKFLOW_PORT = Symbol('PAYMENT_WORKFLOW_PORT');

export interface PaymentWorkflowPort {
  markReservationAsPaidAndNotify(payment: Payment): Promise<void>;
}
