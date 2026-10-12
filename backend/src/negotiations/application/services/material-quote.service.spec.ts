import { MaterialQuoteService } from './material-quote.service';
import { PrismaService } from '../../../prisma/prisma.service';
import { NotificationsService } from '../../../notifications/application/services/notifications.service';
import type { AuthUser } from '../../../auth/security/auth-user.type';

const provider = { sub: 'provider', role: 'PRESTATAIRE' } as AuthUser;
const items = [{ designation: ' PVC ', unitPrice: 0, quantity: 3 }];
function setup(status = 'PAYEE_SEQUESTRE') {
  const prisma = {
    reservation: {
      findUnique: jest
        .fn()
        .mockResolvedValue({
          clientId: 'client',
          statut: status,
          professionnel: { utilisateurId: 'provider' },
        }),
    },
    devisMaterielNegotiation: {
      create: jest
        .fn()
        .mockImplementation(({ data }) =>
          Promise.resolve({ id: 'quote', ...data }),
        ),
    },
    $transaction: jest
      .fn()
      .mockImplementation((operations) => Promise.all(operations)),
  };
  const notifications = {
    createInAppNotification: jest.fn().mockResolvedValue({}),
  };
  return {
    prisma,
    notifications,
    service: new MaterialQuoteService(
      prisma as unknown as PrismaService,
      notifications as unknown as NotificationsService,
    ),
  };
}

describe('Reservation material lists', () => {
  it.each(['CONFIRMEE', 'PAYEE_SEQUESTRE'])(
    'adds material without a negotiation to a %s reservation and notifies only its client',
    async (status) => {
      const { service, prisma, notifications } = setup(status);
      const result = await service.createForReservation(
        provider,
        'reservation',
        items,
      );
      expect(result).toHaveLength(1);
      expect(prisma.devisMaterielNegotiation.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            reservationId: 'reservation',
            designation: 'PVC',
            quantite: 3,
            creeParId: 'provider',
            statut: 'VALIDE',
          }),
        }),
      );
      expect(
        prisma.devisMaterielNegotiation.create.mock.calls[0][0].data,
      ).not.toHaveProperty('negotiationId');
      expect(
        prisma.devisMaterielNegotiation.create.mock.calls[0][0].data,
      ).not.toHaveProperty('valideClientLe');
      expect(notifications.createInAppNotification).toHaveBeenCalledTimes(1);
      expect(notifications.createInAppNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'client',
          data: { reservationId: 'reservation', materialList: true },
        }),
      );
    },
  );
  it.each(['client', 'other-provider'])(
    'rejects an unauthorized author: %s',
    async (sub) => {
      const { service, prisma, notifications } = setup();
      await expect(
        service.createForReservation(
          { ...provider, sub },
          'reservation',
          items,
        ),
      ).rejects.toThrow();
      expect(prisma.devisMaterielNegotiation.create).not.toHaveBeenCalled();
      expect(notifications.createInAppNotification).not.toHaveBeenCalled();
    },
  );
  it.each(['EN_COURS', 'TERMINEE', 'ANNULEE', 'NO_SHOW', 'LITIGE'])(
    'rejects additions to a %s reservation',
    async (status) => {
      const { service, prisma } = setup(status);
      await expect(
        service.createForReservation(provider, 'reservation', items),
      ).rejects.toThrow();
      expect(prisma.devisMaterielNegotiation.create).not.toHaveBeenCalled();
    },
  );
  it('sends one notification for the whole list', async () => {
    const { service, notifications } = setup();
    await service.createForReservation(provider, 'reservation', [
      ...items,
      ...items,
    ]);
    expect(notifications.createInAppNotification).toHaveBeenCalledTimes(1);
  });
});
