import { NotificationsService } from './notifications.service';

describe('NotificationsService delivery labels', () => {
  const repository = {
    create: jest.fn(),
    createMany: jest.fn(),
    resolveReservationNotificationServiceContext: jest.fn(),
  };
  const delivery = { sendPushForNotification: jest.fn() };
  const events = { emit: jest.fn() };
  const service = new NotificationsService(
    repository as never,
    {} as never,
    delivery as never,
    events as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    repository.create.mockImplementation((input) => Promise.resolve(input));
    repository.createMany.mockImplementation((inputs) =>
      Promise.resolve(inputs),
    );
    delivery.sendPushForNotification.mockResolvedValue(undefined);
  });

  it('uses the medication delivery label throughout a reservation notification', async () => {
    repository.resolveReservationNotificationServiceContext.mockResolvedValue({
      sourceServiceName: 'Coursier express',
      displayServiceName: 'Livraison de médicaments',
    });

    await service.createInAppNotification({
      userId: 'client',
      type: 'RESERVATION_FINALISEE',
      title: 'Coursier express terminé',
      body: 'La prestation Coursier express est terminée.',
      data: {
        reservationId: 'reservation-pharmacy',
        serviceName: 'Coursier express',
      },
    });

    expect(repository.create).toHaveBeenCalledWith({
      userId: 'client',
      type: 'RESERVATION_FINALISEE',
      title: 'Livraison de médicaments terminé',
      body: 'La prestation Livraison de médicaments est terminée.',
      data: {
        reservationId: 'reservation-pharmacy',
        serviceName: 'Livraison de médicaments',
      },
    });
  });

  it('resolves a shared reservation only once for notifications sent to both parties', async () => {
    repository.resolveReservationNotificationServiceContext.mockResolvedValue({
      sourceServiceName: 'Transport',
      displayServiceName: 'Livraison de médicaments',
    });

    await service.createManyInAppNotifications([
      {
        userId: 'client',
        type: 'PAIEMENT_LIBERE',
        title: 'Transport terminé',
        body: 'Transport terminé.',
        data: { reservationId: 'reservation-pharmacy' },
      },
      {
        userId: 'courier',
        type: 'PAIEMENT_LIBERE',
        title: 'Transport terminé',
        body: 'Transport terminé.',
        data: { reservationId: 'reservation-pharmacy' },
      },
    ]);

    expect(
      repository.resolveReservationNotificationServiceContext,
    ).toHaveBeenCalledTimes(1);
    expect(repository.createMany).toHaveBeenCalledWith([
      expect.objectContaining({
        userId: 'client',
        title: 'Livraison de médicaments terminé',
        data: expect.objectContaining({
          serviceName: 'Livraison de médicaments',
        }),
      }),
      expect.objectContaining({
        userId: 'courier',
        title: 'Livraison de médicaments terminé',
        data: expect.objectContaining({
          serviceName: 'Livraison de médicaments',
        }),
      }),
    ]);
  });

  it('uses the material delivery label after pickup and until completion', async () => {
    repository.resolveReservationNotificationServiceContext.mockResolvedValue({
      sourceServiceName: 'Livraison de colis',
      displayServiceName: 'Livraison de matériel',
    });

    await service.createInAppNotification({
      userId: 'courier',
      type: 'RETRAIT_EFFECTUE',
      title: 'Retrait Livraison de colis effectué',
      body: 'La prestation Livraison de colis continue vers le destinataire.',
      data: {
        reservationId: 'reservation-material',
        serviceName: 'Livraison de colis',
      },
    });

    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Retrait Livraison de matériel effectué',
        body: 'La prestation Livraison de matériel continue vers le destinataire.',
        data: expect.objectContaining({
          reservationId: 'reservation-material',
          serviceName: 'Livraison de matériel',
        }),
      }),
    );
  });
});
