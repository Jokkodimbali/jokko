import type { AppointmentView } from './appointments.models';

/** A trip or arrival may set EN_COURS before the work actually starts. */
export function canRefundBeforeWork(appointment: AppointmentView): boolean {
  if (appointment.workStartedAt || ['EN_ATTENTE', 'ECHEC', 'REMBOURSE'].includes(appointment.paymentStatus ?? '')) {
    return false;
  }
  if (appointment.status === 'CONFIRMEE') return appointment.paymentStatus === 'SUCCES';
  return appointment.status === 'PAYEE_SEQUESTRE' || appointment.status === 'EN_COURS';
}

export function hasCompletedCancellationRefund(appointment: AppointmentView): boolean {
  return appointment.status === 'ANNULEE' && appointment.refund?.status === 'TERMINE' &&
    !appointment.refund.simulated;
}
