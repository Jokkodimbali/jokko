import { WithdrawalService } from './withdrawal.service';
import { PaymentAmount } from '../../domain/value-objects/payment-amount.vo';
import { WithdrawalStatus } from '../../domain/value-objects/payment-types.vo';
import type { WithdrawalRequest } from '../../domain/entities/withdrawal-request.entity';

describe('WithdrawalService', () => {
  function setup(method: 'WAVE' | 'ORANGE_MONEY' = 'WAVE') {
    let saved: WithdrawalRequest | undefined;
    const repository = {
      save: jest.fn(async (withdrawal: WithdrawalRequest) => {
        saved = withdrawal;
      }),
      findById: jest.fn(async () => saved),
    };
    const ledger = {
      getAvailableBalance: jest.fn().mockResolvedValue(10000),
      debitWithdrawal: jest.fn(async () => {
        saved = { ...saved!, status: WithdrawalStatus.COMPLETED };
      }),
    };
    const dispatcher = { publish: jest.fn() };
    const notifications = {
      createInAppNotification: jest.fn(
        async ({ userId }: { userId: string }) => {
          if (userId !== 'professional-user-id') {
            throw new Error('Notification recipient must reference a user');
          }
        },
      ),
    };
    const prisma = {
      profilProfessionnel: {
        findUniqueOrThrow: jest
          .fn()
          .mockResolvedValue({ utilisateurId: 'professional-user-id' }),
      },
    };
    const service = new WithdrawalService(
      repository as never,
      ledger as never,
      dispatcher as never,
      notifications as never,
      prisma as never,
    );
    const params = {
      professionalId: 'professional-profile-id',
      amount: 3000,
      method,
    };
    return { service, repository, ledger, notifications, prisma, params };
  }

  it.each(['WAVE', 'ORANGE_MONEY'] as const)(
    'completes a %s withdrawal and notifies the user account',
    async (method) => {
      const { service, ledger, notifications, prisma, params } = setup(method);
      const result = await service.requestWithdrawal(params);
      expect(result.status).toBe(WithdrawalStatus.COMPLETED);
      expect(prisma.profilProfessionnel.findUniqueOrThrow).toHaveBeenCalledWith(
        {
          where: { id: params.professionalId },
          select: { utilisateurId: true },
        },
      );
      expect(ledger.debitWithdrawal).toHaveBeenCalledTimes(1);
      expect(ledger.debitWithdrawal).toHaveBeenCalledWith(
        expect.objectContaining({
          professionalId: params.professionalId,
          amount: 3000,
          withdrawalId: result.id,
        }),
      );
      expect(notifications.createInAppNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'professional-user-id',
          type: 'RETRAIT_EFFECTUE',
          data: {
            withdrawalId: result.id,
            amount: 3000,
            method,
            walletDebit: true,
          },
        }),
      );
    },
  );

  it('does not debit when the recipient account cannot be resolved', async () => {
    const { service, ledger, notifications, prisma, params } = setup();
    prisma.profilProfessionnel.findUniqueOrThrow.mockRejectedValue(
      new Error('Profile missing'),
    );
    await expect(service.requestWithdrawal(params)).rejects.toThrow(
      'Profile missing',
    );
    expect(ledger.debitWithdrawal).not.toHaveBeenCalled();
    expect(notifications.createInAppNotification).not.toHaveBeenCalled();
  });

  it('does not debit an already completed withdrawal again', async () => {
    const { service, repository, ledger, notifications } = setup();
    repository.findById.mockResolvedValue({
      id: 'withdrawal-id',
      professionalId: 'professional-profile-id',
      amount: PaymentAmount.create(3000),
      method: 'WAVE',
      status: WithdrawalStatus.COMPLETED,
      requestedAt: new Date(),
    });
    await expect(service.processWithdrawal('withdrawal-id')).rejects.toThrow();
    expect(ledger.debitWithdrawal).not.toHaveBeenCalled();
    expect(notifications.createInAppNotification).not.toHaveBeenCalled();
  });
});
