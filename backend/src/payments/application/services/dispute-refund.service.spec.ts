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

  it('refunds a cancelled reservation to the original payment method before marking it refunded', async () => {
    const prisma = {
      paiement: {
        findUnique: jest
          .fn()
          .mockImplementation(
            ({ where }: { where: { reservationId?: string } }) =>
              Promise.resolve(
                where.reservationId
                  ? { id: 'payment-1', montant: 5_000, statut: 'SUCCES' }
                  : {
                      gatewayReference: 'gateway-1',
                      referenceFournisseur: null,
                      escrowStatus: 'LOCKED',
                    },
              ),
          ),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
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

    await service.refundForCancellation({
      reservationId: 'reservation-1',
      reason: 'Annulation du RDV',
    });

    expect(gateway.processRefund).toHaveBeenCalledWith({
      gatewayReference: 'gateway-1',
      amount: 5_000,
      reason: 'Annulation du RDV',
      idempotencyKey: 'reservation-cancellation-refund:reservation-1',
    });
    expect(prisma.remboursementPaiement.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        reservationId: 'reservation-1',
        paiementId: 'payment-1',
      }),
    });
    expect(prisma.paiement.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          statut: 'REMBOURSE',
          escrowStatus: 'REFUNDED',
        }),
      }),
    );
  });

  it('does not mark the payment refunded when the provider rejects cancellation refund', async () => {
    const prisma = {
      paiement: {
        findUnique: jest
          .fn()
          .mockImplementation(
            ({ where }: { where: { reservationId?: string } }) =>
              Promise.resolve(
                where.reservationId
                  ? { id: 'payment-1', montant: 5_000, statut: 'SUCCES' }
                  : {
                      gatewayReference: 'gateway-1',
                      referenceFournisseur: null,
                      escrowStatus: 'LOCKED',
                    },
              ),
          ),
        updateMany: jest.fn(),
      },
      remboursementPaiement: {
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({ id: 'refund-1' }),
        update: jest.fn().mockResolvedValue(undefined),
      },
    };
    const gateway = {
      processRefund: jest.fn().mockResolvedValue({ success: false }),
    };
    const service = new DisputeRefundService(prisma as never, gateway);

    await expect(
      service.refundForCancellation({
        reservationId: 'reservation-1',
        reason: 'Annulation',
      }),
    ).rejects.toThrow();
    expect(prisma.paiement.updateMany).not.toHaveBeenCalled();
    expect(prisma.remboursementPaiement.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ statut: 'ECHEC' }),
      }),
    );
  });

  it('refuses cancellation when a paid reservation has no payment record', async () => {
    const prisma = {
      paiement: { findUnique: jest.fn().mockResolvedValue(null) },
    };
    const gateway = { processRefund: jest.fn() };
    const service = new DisputeRefundService(prisma as never, gateway);

    await expect(
      service.refundForCancellation({
        reservationId: 'reservation-1',
        reason: 'Annulation',
        paymentRequired: true,
      }),
    ).rejects.toThrow('PAYMENTS_CANCELLATION_PAYMENT_MISSING');
    expect(gateway.processRefund).not.toHaveBeenCalled();
  });

  it('refuses cancellation while payment is pending', async () => {
    const prisma = {
      paiement: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ id: 'payment-1', statut: 'EN_ATTENTE' }),
      },
    };
    const gateway = { processRefund: jest.fn() };
    const service = new DisputeRefundService(prisma as never, gateway);

    await expect(
      service.refundForCancellation({
        reservationId: 'reservation-1',
        reason: 'Annulation',
      }),
    ).rejects.toThrow('PAYMENTS_CANCELLATION_PAYMENT_PENDING');
    expect(gateway.processRefund).not.toHaveBeenCalled();
  });
});
