import { EscrowService } from './escrow.service';
import { Payment } from '../../domain/entities/payment.entity';
import { PaymentAmount } from '../../domain/value-objects/payment-amount.vo';
import { PaymentMethod } from '../../domain/value-objects/payment-types.vo';

describe('EscrowService release notifications', () => {
  function setup() {
    const payment = Payment.create({
      id: 'payment-id',
      bookingId: 'booking-id',
      clientId: 'client-user-id',
      professionalId: 'professional-profile-id',
      method: PaymentMethod.WAVE,
      amount: PaymentAmount.create(10000),
    });
    payment.markAsSuccess('gateway-ref');
    payment.clearDomainEvents();
    const repository = { findById: jest.fn().mockResolvedValue(payment) };
    const dispatcher = { publishMany: jest.fn() };
    const ledger = {
      creditReleasedEscrow: jest.fn().mockResolvedValue(undefined),
    };
    const notifications = {
      createManyInAppNotifications: jest
        .fn()
        .mockImplementation(async (inputs) => {
          for (const input of inputs) {
            if (
              !['client-user-id', 'professional-user-id'].includes(input.userId)
            ) {
              throw new Error('Notification recipient must reference a user');
            }
          }
        }),
    };
    const prisma = {
      profilProfessionnel: {
        findUniqueOrThrow: jest
          .fn()
          .mockResolvedValue({ utilisateurId: 'professional-user-id' }),
      },
      reservation: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ service: { nom: 'Consultation' } }),
      },
    };
    const service = new EscrowService(
      repository as never,
      dispatcher as never,
      ledger as never,
      notifications as never,
      prisma as never,
    );
    return { service, payment, ledger, notifications, prisma };
  }

  it('credits the profile and addresses notifications to the client and professional user accounts', async () => {
    const { service, payment, ledger, notifications, prisma } = setup();
    await expect(service.releaseEscrow(payment.id)).resolves.toBe(payment);
    expect(payment.isEscrowReleased()).toBe(true);
    expect(ledger.creditReleasedEscrow).toHaveBeenCalledTimes(1);
    expect(ledger.creditReleasedEscrow).toHaveBeenCalledWith(payment);
    expect(prisma.profilProfessionnel.findUniqueOrThrow).toHaveBeenCalledWith({
      where: { id: 'professional-profile-id' },
      select: { utilisateurId: true },
    });
    expect(notifications.createManyInAppNotifications).toHaveBeenCalledWith([
      expect.objectContaining({ userId: 'client-user-id' }),
      expect.objectContaining({
        userId: 'professional-user-id',
        data: expect.objectContaining({ walletCredit: true }),
      }),
    ]);
  });

  it('does not credit the wallet when the professional account cannot be resolved', async () => {
    const { service, payment, ledger, notifications, prisma } = setup();
    prisma.profilProfessionnel.findUniqueOrThrow.mockRejectedValue(
      new Error('Profile missing'),
    );
    await expect(service.releaseEscrow(payment.id)).rejects.toThrow(
      'Profile missing',
    );
    expect(payment.isEscrowLocked()).toBe(true);
    expect(ledger.creditReleasedEscrow).not.toHaveBeenCalled();
    expect(notifications.createManyInAppNotifications).not.toHaveBeenCalled();
  });
});
