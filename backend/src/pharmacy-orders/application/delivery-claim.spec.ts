import { PharmacyOrdersService } from './pharmacy-orders.service';

describe('pharmacy delivery claim', () => {
  it('allows only one claimant and resolves all recipients only for the winner', async () => {
    let claimed = false;
    const order = {
      id: 'order',
      clientId: 'client',
      client: { id: 'client' },
      livraisonDemandee: true,
      montantLivraison: 500,
      distanceLivraisonKm: 1,
      adresseLivraison: 'Dakar',
      pharmacie: {
        nomEntreprise: 'Pharmacie',
        utilisateur: { id: 'merchant', nom: 'Pharmacien' },
      },
    };
    const tx = {
      commandePharmacie: {
        updateMany: jest.fn(async () => {
          if (claimed) return { count: 0 };
          claimed = true;
          return { count: 1 };
        }),
        findUniqueOrThrow: jest.fn().mockResolvedValue(order),
        update: jest.fn(),
      },
      reservation: { create: jest.fn() },
      paiement: { create: jest.fn() },
    };
    const prisma = {
      commandePharmacie: {
        findFirst: jest.fn().mockResolvedValue(order),
        findUniqueOrThrow: jest.fn().mockResolvedValue(order),
      },
      $transaction: jest.fn((callback) => callback(tx)),
    };
    const notifications = {
      resolveDeliveryOffers: jest.fn(),
      createInAppNotification: jest.fn(),
    };
    const service = new PharmacyOrdersService(
      prisma as never,
      notifications as never,
      {} as never,
      { get: jest.fn().mockResolvedValue({ pricePerKm: 500, courierCommissionRate: 10 }) } as never,
    );
    jest.spyOn(service as any, 'findEligibleCourier').mockResolvedValue({
      professionalId: 'courier-profile',
      serviceId: 'service',
      durationMinutes: 10,
      commissionRate: 10,
    });
    jest
      .spyOn(service as any, 'pharmacyAddress')
      .mockReturnValue('Pharmacie Dakar');
    jest.spyOn(service as any, 'toView').mockReturnValue(order);
    const results = await Promise.allSettled([
      service.acceptDelivery({ sub: 'courier-a' } as never, 'order'),
      service.acceptDelivery({ sub: 'courier-b' } as never, 'order'),
    ]);
    expect(
      results.filter((result) => result.status === 'fulfilled'),
    ).toHaveLength(1);
    expect(
      results.filter((result) => result.status === 'rejected'),
    ).toHaveLength(1);
    expect(tx.reservation.create).toHaveBeenCalledTimes(1);
    expect(notifications.resolveDeliveryOffers).toHaveBeenCalledTimes(1);
    expect(notifications.resolveDeliveryOffers).toHaveBeenCalledWith(
      'pharmacyOrderId',
      'order',
    );
  });
});
