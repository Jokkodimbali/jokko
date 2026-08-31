import { BadRequestException, ForbiddenException } from '@nestjs/common';
import {
  MethodePaiement,
  StatutCommandePharmacie,
  StatutPaiement,
  TypeTransactionPortefeuille,
} from '@prisma/client';
import type { AuthUser } from '../../../auth/security/auth-user.type';
import { PharmacyOrderPaymentService } from './pharmacy-order-payment.service';

describe('PharmacyOrderPaymentService', () => {
  const client = {
    sub: '11111111-1111-4111-8111-111111111111',
    role: 'CLIENT',
  } as AuthUser;
  const orderId = '22222222-2222-4222-8222-222222222222';
  const pharmacyId = '33333333-3333-4333-8333-333333333333';
  const paymentId = '44444444-4444-4444-8444-444444444444';
  const pharmacyUserId = '55555555-5555-4555-8555-555555555555';

  const prisma = {
    commandePharmacie: {
      findFirst: jest.fn(),
      updateMany: jest.fn(),
    },
    paiementCommandePharmacie: {
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      findFirst: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      delete: jest.fn(),
    },
    profilProfessionnel: { update: jest.fn() },
    transactionPortefeuille: { create: jest.fn() },
    $queryRaw: jest.fn().mockResolvedValue([]),
    $transaction: jest.fn(),
  };
  const gateway = { initiatePayment: jest.fn() };
  const notifications = { createInAppNotification: jest.fn() };
  const config = { get: jest.fn() };
  const service = new PharmacyOrderPaymentService(
    prisma as never,
    notifications as never,
    config as never,
    gateway as never,
  );

  const order = {
    id: orderId,
    clientId: client.sub,
    pharmacieId: pharmacyId,
    statut: StatutCommandePharmacie.EN_ATTENTE_PAIEMENT,
    montantMedicaments: 12500,
    livraisonDemandee: false,
    montantLivraison: null,
    paiement: null,
    client: {
      nom: 'Patient Jokko',
      email: null,
      numeroTelephone: '+221770000000',
    },
    pharmacie: {
      nomEntreprise: 'Pharmacie Jokko',
      utilisateur: { nom: 'Pharmacien Jokko' },
    },
  };

  const payment = {
    id: paymentId,
    commandePharmacieId: orderId,
    clientId: client.sub,
    pharmacieId: pharmacyId,
    montant: 12500,
    methode: MethodePaiement.WAVE,
    statut: StatutPaiement.EN_ATTENTE,
    cleIdempotence: 'payment-key',
    referenceTransaction: 'PHA-local',
    referenceFournisseur: 'wave-provider-ref',
    urlPaiement: 'https://pay.example.test',
    traiteLe: null,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.$transaction.mockImplementation(
      (callback: (tx: typeof prisma) => unknown) => callback(prisma),
    );
  });

  it('initiates a payment with the exact pharmacy fixed amount', async () => {
    prisma.commandePharmacie.findFirst.mockResolvedValue(order);
    prisma.paiementCommandePharmacie.create.mockResolvedValue({
      ...payment,
      referenceFournisseur: null,
      urlPaiement: null,
    });
    gateway.initiatePayment.mockResolvedValue({
      success: true,
      gatewayReference: payment.referenceFournisseur,
      paymentUrl: payment.urlPaiement,
    });
    prisma.paiementCommandePharmacie.update.mockResolvedValue(payment);

    const result = await service.initiate(client, orderId, {
      method: 'WAVE',
      idempotencyKey: 'payment-key',
    });

    expect(gateway.initiatePayment).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 12500,
        currency: 'XOF',
        method: 'WAVE',
        metadata: expect.objectContaining({ pharmacyOrderId: orderId }),
      }),
    );
    expect(result).toEqual(
      expect.objectContaining({ amount: 12500, status: 'EN_ATTENTE' }),
    );
  });

  it('allows payment for the priced medicines of a partially available order', async () => {
    prisma.commandePharmacie.findFirst.mockResolvedValue({
      ...order,
      statut: StatutCommandePharmacie.PARTIELLEMENT_DISPONIBLE,
      montantMedicaments: 5000,
    });
    prisma.paiementCommandePharmacie.create.mockResolvedValue({
      ...payment,
      montant: 5000,
      referenceFournisseur: null,
      urlPaiement: null,
    });
    gateway.initiatePayment.mockResolvedValue({
      success: true,
      gatewayReference: payment.referenceFournisseur,
      paymentUrl: payment.urlPaiement,
    });
    prisma.paiementCommandePharmacie.update.mockResolvedValue({
      ...payment,
      montant: 5000,
    });

    const result = await service.initiate(client, orderId, {
      method: 'WAVE',
      idempotencyKey: 'payment-key',
    });

    expect(gateway.initiatePayment).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 5000 }),
    );
    expect(result.amount).toBe(5000);
  });

  it('includes delivery in the single payment when the client requested it', async () => {
    prisma.commandePharmacie.findFirst.mockResolvedValue({
      ...order,
      livraisonDemandee: true,
      montantLivraison: 2500,
    });
    prisma.paiementCommandePharmacie.create.mockResolvedValue({
      ...payment,
      montant: 15000,
      referenceFournisseur: null,
      urlPaiement: null,
    });
    gateway.initiatePayment.mockResolvedValue({
      success: true,
      gatewayReference: payment.referenceFournisseur,
      paymentUrl: payment.urlPaiement,
    });
    prisma.paiementCommandePharmacie.update.mockResolvedValue({
      ...payment,
      montant: 15000,
    });

    const result = await service.initiate(client, orderId, {
      method: 'WAVE',
      idempotencyKey: 'payment-key',
    });

    expect(gateway.initiatePayment).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 15000,
        description: expect.stringContaining('livraison'),
      }),
    );
    expect(result.amount).toBe(15000);
  });

  it('rejects payment before pharmacy acceptance', async () => {
    prisma.commandePharmacie.findFirst.mockResolvedValue({
      ...order,
      statut: StatutCommandePharmacie.EN_ATTENTE_PHARMACIE,
      montantMedicaments: null,
    });

    await expect(
      service.initiate(client, orderId, {
        method: 'WAVE',
        idempotencyKey: 'payment-key',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(gateway.initiatePayment).not.toHaveBeenCalled();
  });

  it('rejects payment from a non-client account', async () => {
    await expect(
      service.initiate(
        { ...client, role: 'PRESTATAIRE' } as AuthUser,
        orderId,
        { method: 'WAVE', idempotencyKey: 'payment-key' },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('confirms once, credits only the medicines and notifies couriers when delivery is requested', async () => {
    const deliveryOrder = {
      ...order,
      livraisonDemandee: true,
      montantLivraison: 2500,
    };
    const deliveryPayment = { ...payment, montant: 15000 };
    prisma.$queryRaw.mockResolvedValueOnce([
      {
        userId: '66666666-6666-4666-8666-666666666666',
        distanceKm: 4.2,
      },
    ]);
    prisma.paiementCommandePharmacie.findFirst
      .mockResolvedValueOnce(deliveryPayment)
      .mockResolvedValueOnce({
        ...deliveryPayment,
        commandePharmacie: deliveryOrder,
        pharmacie: {
          id: pharmacyId,
          nomEntreprise: 'Pharmacie Jokko',
          utilisateur: { id: pharmacyUserId, nom: 'Pharmacien Jokko' },
        },
      });
    prisma.paiementCommandePharmacie.updateMany.mockResolvedValue({ count: 1 });
    prisma.commandePharmacie.updateMany.mockResolvedValue({ count: 1 });
    prisma.profilProfessionnel.update.mockResolvedValue({
      soldePortefeuille: 12500,
    });
    prisma.paiementCommandePharmacie.findUniqueOrThrow.mockResolvedValue({
      ...payment,
      statut: StatutPaiement.SUCCES,
      traiteLe: new Date(),
    });

    const handled = await service.processGatewayStatus(
      deliveryPayment.referenceFournisseur,
      'completed',
    );

    expect(handled).toBe(true);
    expect(prisma.commandePharmacie.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          statut: {
            in: [
              StatutCommandePharmacie.EN_ATTENTE_PAIEMENT,
              StatutCommandePharmacie.PARTIELLEMENT_DISPONIBLE,
            ],
          },
        }),
        data: expect.objectContaining({
          statut: StatutCommandePharmacie.EN_ATTENTE_TRANSPORTEUR,
        }),
      }),
    );
    expect(prisma.transactionPortefeuille.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        type: TypeTransactionPortefeuille.CREDIT_PHARMACIE,
        montant: 12500,
      }),
    });
    expect(notifications.createInAppNotification).toHaveBeenCalledTimes(3);
    expect(notifications.createInAppNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: '66666666-6666-4666-8666-666666666666',
        title: 'Livraison de medicaments disponible',
        data: expect.objectContaining({
          pharmacyOrderId: orderId,
          route: `/pharmacy-orders/${orderId}/delivery-offer`,
        }),
      }),
    );
  });

  it('keeps pickup at the pharmacy and does not notify couriers without delivery', async () => {
    prisma.paiementCommandePharmacie.findFirst
      .mockResolvedValueOnce(payment)
      .mockResolvedValueOnce({
        ...payment,
        commandePharmacie: order,
        pharmacie: {
          id: pharmacyId,
          nomEntreprise: 'Pharmacie Jokko',
          utilisateur: { id: pharmacyUserId, nom: 'Pharmacien Jokko' },
        },
      });
    prisma.paiementCommandePharmacie.updateMany.mockResolvedValue({ count: 1 });
    prisma.commandePharmacie.updateMany.mockResolvedValue({ count: 1 });
    prisma.profilProfessionnel.update.mockResolvedValue({
      soldePortefeuille: 12500,
    });
    prisma.paiementCommandePharmacie.findUniqueOrThrow.mockResolvedValue({
      ...payment,
      statut: StatutPaiement.SUCCES,
    });

    await service.processGatewayStatus(
      payment.referenceFournisseur,
      'completed',
    );

    expect(prisma.commandePharmacie.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          statut: StatutCommandePharmacie.PAYEE_PHARMACIE,
        }),
      }),
    );
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
    expect(notifications.createInAppNotification).toHaveBeenCalledTimes(2);
  });
});
