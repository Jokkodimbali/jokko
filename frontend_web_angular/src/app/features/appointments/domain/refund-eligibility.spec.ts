import { describe, expect, it } from 'vitest';
import type { AppointmentView } from './appointments.models';
import { canRefundBeforeWork, hasCompletedCancellationRefund } from './refund-eligibility';

function appointment(overrides: Partial<AppointmentView> = {}): AppointmentView {
  return {
    status: 'PAYEE_SEQUESTRE',
    paymentStatus: 'SUCCES',
    workStartedAt: null,
    ...overrides,
  } as AppointmentView;
}

describe('canRefundBeforeWork', () => {
  it('keeps the refund available during travel and arrival before work starts', () => {
    expect(canRefundBeforeWork(appointment({ status: 'EN_COURS' }))).toBe(true);
  });

  it('hides the refund after the provider starts the work', () => {
    expect(canRefundBeforeWork(appointment({ status: 'EN_COURS', workStartedAt: new Date().toISOString() }))).toBe(false);
  });

  it('does not offer a refund for a pending or failed payment', () => {
    expect(canRefundBeforeWork(appointment({ paymentStatus: 'EN_ATTENTE' }))).toBe(false);
    expect(canRefundBeforeWork(appointment({ paymentStatus: 'ECHEC' }))).toBe(false);
  });
});

describe('hasCompletedCancellationRefund', () => {
  it('shows the receipt after a real completed refund even if payment status is stale', () => {
    const cancelled = appointment({ status: 'ANNULEE', paymentStatus: 'REMBOURSE' });
    expect(hasCompletedCancellationRefund(cancelled)).toBe(false);
    expect(hasCompletedCancellationRefund({
      ...cancelled,
      refund: { amount: 40000, status: 'EN_COURS', simulated: false, reference: null, completedAt: null },
    })).toBe(false);
    expect(hasCompletedCancellationRefund({
      ...cancelled,
      refund: { amount: 40000, status: 'TERMINE', simulated: false, reference: 'refund-1', completedAt: new Date().toISOString() },
    })).toBe(true);
    expect(hasCompletedCancellationRefund({
      ...cancelled,
      paymentStatus: 'SUCCES',
      refund: { amount: 40000, status: 'TERMINE', simulated: false, reference: 'refund-1', completedAt: new Date().toISOString() },
    })).toBe(true);
    expect(hasCompletedCancellationRefund({
      ...cancelled,
      refund: { amount: 40000, status: 'TERMINE', simulated: true, reference: null, completedAt: new Date().toISOString() },
    })).toBe(false);
  });
});
