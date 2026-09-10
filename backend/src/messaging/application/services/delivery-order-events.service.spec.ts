import { DeliveryOrderEventsService } from './delivery-order-events.service';

describe('delivery order mission events', () => {
  it('refreshes only the client and merchant attached to the reservation', async () => {
    const prisma = { commandePharmacie: { findUnique: jest.fn().mockResolvedValue({ id: 'order', clientId: 'client', pharmacie: { utilisateurId: 'pharmacy' } }) }, commandeMateriel: { findUnique: jest.fn().mockResolvedValue(null) } };
    const events = { emit: jest.fn() };
    const service = new DeliveryOrderEventsService(prisma as never, events as never);
    await service.onMissionChanged({ payload: { reservationId: 'reservation' } });
    expect(prisma.commandePharmacie.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { reservationLivraisonId: 'reservation' } }));
    expect(events.emit.mock.calls).toEqual([
      ['delivery-order.updated', { kind: 'PHARMACY', orderId: 'order', userId: 'client' }],
      ['delivery-order.updated', { kind: 'PHARMACY', orderId: 'order', userId: 'pharmacy' }],
    ]);
  });
  it('deduplicates the recipient when the hardware merchant is also the client', async () => {
    const prisma = { commandePharmacie: { findUnique: jest.fn().mockResolvedValue(null) }, commandeMateriel: { findUnique: jest.fn().mockResolvedValue({ id: 'order', clientId: 'merchant', quincaillerie: { utilisateurId: 'merchant' } }) } };
    const events = { emit: jest.fn() };
    await new DeliveryOrderEventsService(prisma as never, events as never).onMissionChanged({ payload: { reservationId: 'reservation' } });
    expect(events.emit).toHaveBeenCalledTimes(1);
    expect(events.emit).toHaveBeenCalledWith('delivery-order.updated', { kind: 'MATERIAL', orderId: 'order', userId: 'merchant' });
  });
});
