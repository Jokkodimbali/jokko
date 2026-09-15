import { DisputeRefundService } from './dispute-refund.service';

describe('DisputeRefundService', () => {
  const input = {
    disputeId: 'dispute-1',
    paymentId: 'payment-1',
    amount: 5_000,
    reason: 'Prestation non fournie',
  };

  it('records a completed refund only after the payment gateway succeeds', async () => {
    const prisma = {
      paiement: {
        findUnique: jest.fn().mockResolvedValue({
          gatewayReference: 'gateway-1',
          referenceFournisseur: null,
          escrowStatus: 'DISPUTED',
        }),
      },
      remboursementPaiement: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'refund-1' }),
        update: jest.fn().mockResolvedValue(undefined),
      },
    };
    const gateway = {
      processRefund: jest.fn().mockResolvedValue({
        success: true,
        gatewayReference: 'refund-provider-1',
      }),
    };
    const service = new DisputeRefundService(prisma as never, gateway);

    await service.refundForDispute(input);

    expect(gateway.processRefund).toHaveBeenCalledWith({
      gatewayReference: 'gateway-1',
      amount: 5_000,
      reason: input.reason,
      idempotencyKey: 'dispute-refund:dispute-1',
    });
    expect(prisma.remboursementPaiement.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          statut: 'TERMINE',
          referenceFournisseur: 'refund-provider-1',
        }),
      }),
    );
  });

  it('does not call the provider twice when the dispute was already refunded', async () => {
    const prisma = {
      paiement: {
        findUnique: jest.fn().mockResolvedValue({
          gatewayReference: 'gateway-1',
          referenceFournisseur: null,
          escrowStatus: 'DISPUTED',
        }),
      },
      remboursementPaiement: {
        findUnique: jest.fn().mockResolvedValue({ statut: 'TERMINE' }),
      },
    };
    const gateway = { processRefund: jest.fn() };
    const service = new DisputeRefundService(prisma as never, gateway);

    await service.refundForDispute(input);

    expect(gateway.processRefund).not.toHaveBeenCalled();
  });
});
