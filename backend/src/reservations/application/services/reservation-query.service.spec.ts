import { ReservationQueryService } from './reservation-query.service';
import type { AuthUser } from '../../../auth/security/auth-user.type';
import type { ReservationsRepositoryPort } from '../ports/reservations-repository.port';
import type { ProfessionalsRepositoryPort } from '../../../professionals/application/ports/professionals-repository.port';

describe('ReservationQueryService', () => {
  const clientUser: AuthUser = {
    sub: 'client-id',
    role: 'CLIENT',
    phoneNumber: '+221772345678',
  };

  const adminUser: AuthUser = {
    sub: 'admin-id',
    role: 'ADMIN',
    phoneNumber: '+221771234567',
  };

  const buildService = () => {
    const reservationsRepository = {
      syncOverdueReservations: jest.fn().mockResolvedValue(1),
      findDetailedByFilters: jest.fn().mockResolvedValue([]),
      findByFilters: jest.fn().mockResolvedValue([]),
    } as unknown as jest.Mocked<ReservationsRepositoryPort>;

    const professionalsRepository = {} as jest.Mocked<ProfessionalsRepositoryPort>;

    return {
      service: new ReservationQueryService(
        reservationsRepository,
        professionalsRepository,
      ),
      reservationsRepository,
    };
  };

  it('synchronizes overdue reservations before listing user reservations', async () => {
    const { service, reservationsRepository } = buildService();

    await service.getMyReservations(clientUser, {});

    expect(reservationsRepository.syncOverdueReservations).toHaveBeenCalledTimes(1);
    expect(reservationsRepository.findDetailedByFilters).toHaveBeenCalledWith({
      clientId: clientUser.sub,
    });
    expect(
      reservationsRepository.syncOverdueReservations.mock.invocationCallOrder[0],
    ).toBeLessThan(
      reservationsRepository.findDetailedByFilters.mock.invocationCallOrder[0],
    );
  });

  it('synchronizes overdue reservations before admin statistics', async () => {
    const { service, reservationsRepository } = buildService();

    await service.getReservationStatistics(adminUser, {});

    expect(reservationsRepository.syncOverdueReservations).toHaveBeenCalledTimes(1);
    expect(reservationsRepository.findByFilters).toHaveBeenCalledWith({
      status: undefined,
      serviceId: undefined,
      clientId: undefined,
      professionalId: undefined,
      search: undefined,
    });
  });
});
