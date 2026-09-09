import { NotificationsService } from './notifications.service';

describe('delivery offer resolution', () => {
  const repository = {
    resolveDeliveryOffers: jest.fn(),
    declineDeliveryOffer: jest.fn(),
  };
  const events = { emit: jest.fn() };
  const service = new NotificationsService(
    repository as never,
    {} as never,
    {} as never,
    events as never,
  );
  beforeEach(() => jest.clearAllMocks());
  it('notifies each recipient after resolving the persisted offers', async () => {
    repository.resolveDeliveryOffers.mockResolvedValue([
      'courier-a',
      'courier-b',
    ]);
    await service.resolveDeliveryOffers('pharmacyOrderId', 'order');
    expect(repository.resolveDeliveryOffers).toHaveBeenCalledWith(
      'pharmacyOrderId',
      'order',
    );
    expect(events.emit).toHaveBeenCalledWith('delivery-offer.resolved', {
      userId: 'courier-a',
      orderId: 'order',
    });
    expect(events.emit).toHaveBeenCalledWith('delivery-offer.resolved', {
      userId: 'courier-b',
      orderId: 'order',
    });
  });
  it('only informs the declining courier and does not resolve the order for others', async () => {
    repository.declineDeliveryOffer.mockResolvedValue(true);
    await service.declineDeliveryOffer('courier-a', 'notification');
    expect(repository.declineDeliveryOffer).toHaveBeenCalledWith(
      'courier-a',
      'notification',
    );
    expect(events.emit).toHaveBeenCalledTimes(1);
    expect(events.emit).toHaveBeenCalledWith('delivery-offer.resolved', {
      userId: 'courier-a',
      notificationId: 'notification',
    });
    expect(repository.resolveDeliveryOffers).not.toHaveBeenCalled();
  });
  it('does not emit an event when the notification does not belong to the courier', async () => {
    repository.declineDeliveryOffer.mockResolvedValue(false);
    await expect(
      service.declineDeliveryOffer('other-user', 'notification'),
    ).rejects.toThrow();
    expect(events.emit).not.toHaveBeenCalled();
  });
});
