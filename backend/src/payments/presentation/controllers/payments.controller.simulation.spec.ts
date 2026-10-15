import { ForbiddenException } from '@nestjs/common';
import { PaymentsController } from './payments.controller';

describe('PaymentsController simulated payment availability', () => {
  const user = { sub: 'client-1' } as never;

  function controller(mode: 'mock' | 'external') {
    const simulateReservationPayment = jest
      .fn()
      .mockResolvedValue({ paid: true });
    const config = {
      get: jest.fn((key: string) => {
        if (key === 'NODE_ENV') return 'production';
        if (key === 'PAYMENT_GATEWAY_MODE') return mode;
        return undefined;
      }),
    };
    return {
      instance: new PaymentsController(
        { simulateReservationPayment } as never,
        {} as never,
        config as never,
      ),
      simulateReservationPayment,
    };
  }

  it('announces and confirms simulated payments when production mock mode was explicitly enabled', async () => {
    const { instance, simulateReservationPayment } = controller('mock');

    expect(instance.availableMethods().data).toEqual({
      methods: ['WAVE', 'ORANGE_MONEY', 'CARD'],
      simulated: true,
    });
    await expect(
      instance.simulateReservationPayment(user, 'reservation-1'),
    ).resolves.toMatchObject({ data: { paid: true } });
    expect(simulateReservationPayment).toHaveBeenCalledWith(
      user,
      'reservation-1',
    );
  });

  it('keeps manual confirmation disabled for external payments', async () => {
    const { instance, simulateReservationPayment } = controller('external');

    expect(instance.availableMethods().data.simulated).toBe(false);
    await expect(
      instance.simulateReservationPayment(user, 'reservation-1'),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(simulateReservationPayment).not.toHaveBeenCalled();
  });
});
