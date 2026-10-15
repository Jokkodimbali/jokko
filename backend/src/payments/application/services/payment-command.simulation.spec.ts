import { PaymentCommandService } from './payment-command.service';

describe('PaymentCommandService simulation', () => {
  const makeService = (payment: { clientId: string; gatewayReference: string | null; isSuccessful: () => boolean } | null) => {
    const repository = { findByBookingId: jest.fn().mockResolvedValue(payment) };
    const service = new PaymentCommandService(
      repository as never, {} as never, {} as never, {} as never,
      {} as never, {} as never, {} as never,
    );
    const processPaymentWebhook = jest.spyOn(service, 'processPaymentWebhook')
      .mockResolvedValue({} as never);
    return { service, processPaymentWebhook };
  };

  it('confirms only the current client’s initiated payment', async () => {
    const { service, processPaymentWebhook } = makeService({
      clientId: 'client-1', gatewayReference: 'mock-ref', isSuccessful: () => false,
    });
    await expect(service.simulateReservationPayment('booking-1', 'client-1'))
      .resolves.toEqual({ paid: true });
    expect(processPaymentWebhook).toHaveBeenCalledWith('mock-ref', 'SUCCESS');
  });

  it('rejects another client and never confirms the payment', async () => {
    const { service, processPaymentWebhook } = makeService({
      clientId: 'client-1', gatewayReference: 'mock-ref', isSuccessful: () => false,
    });
    await expect(service.simulateReservationPayment('booking-1', 'client-2'))
      .rejects.toThrow();
    expect(processPaymentWebhook).not.toHaveBeenCalled();
  });

  it('rejects a payment without a gateway reference', async () => {
    const { service, processPaymentWebhook } = makeService({
      clientId: 'client-1', gatewayReference: null, isSuccessful: () => false,
    });
    await expect(service.simulateReservationPayment('booking-1', 'client-1'))
      .rejects.toThrow();
    expect(processPaymentWebhook).not.toHaveBeenCalled();
  });
});
