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

  const professionalUser: AuthUser = {
    sub: 'professional-user-id',
    role: 'PRESTATAIRE',
    phoneNumber: '+221771111111',
  };

  const buildService = () => {
    const reservationsRepository = {
      syncOverdueReservations: jest.fn().mockResolvedValue(1),
      findDetailedByFilters: jest.fn().mockResolvedValue([]),
      findByFilters: jest.fn().mockResolvedValue([]),
    } as unknown as jest.Mocked<ReservationsRepositoryPort>;

    const professionalsRepository = {
      findByUserId: jest.fn().mockResolvedValue({
        id: 'professional-id',
        userId: professionalUser.sub,
      }),
    } as unknown as jest.Mocked<ProfessionalsRepositoryPort>;

    return {
      service: new ReservationQueryService(
        reservationsRepository,
        professionalsRepository,
      ),
      reservationsRepository,
      professionalsRepository,
    };
  };

  it('synchronizes overdue reservations before listing user reservations', async () => {
    const { service, reservationsRepository } = buildService();

    await service.getMyReservations(clientUser, {});

    expect(
      reservationsRepository.syncOverdueReservations,
    ).toHaveBeenCalledTimes(1);
    expect(reservationsRepository.findDetailedByFilters).toHaveBeenCalledWith({
      clientId: clientUser.sub,
    });
    expect(
      reservationsRepository.syncOverdueReservations.mock
        .invocationCallOrder[0],
    ).toBeLessThan(
      reservationsRepository.findDetailedByFilters.mock.invocationCallOrder[0],
    );
  });

  it('lists all provider reservations without applying a status filter by default', async () => {
    const { service, reservationsRepository, professionalsRepository } =
      buildService();

    await service.getMyReservations(professionalUser, {});

    expect(professionalsRepository.findByUserId).toHaveBeenCalledWith(
      professionalUser.sub,
    );
    expect(reservationsRepository.findDetailedByFilters).toHaveBeenCalledWith({
      professionalId: 'professional-id',
    });
  });

  it('applies the provider status filter only when explicitly requested', async () => {
    const { service, reservationsRepository } = buildService();

    await service.getMyReservations(professionalUser, {
      status: 'PAYEE_SEQUESTRE',
    });

    expect(reservationsRepository.findDetailedByFilters).toHaveBeenCalledWith({
      professionalId: 'professional-id',
      status: 'PAYEE_SEQUESTRE',
    });
  });

  it('synchronizes overdue reservations before admin statistics', async () => {
    const { service, reservationsRepository } = buildService();

    await service.getReservationStatistics(adminUser, {});

    expect(
      reservationsRepository.syncOverdueReservations,
    ).toHaveBeenCalledTimes(1);
    expect(reservationsRepository.findByFilters).toHaveBeenCalledWith({
      status: undefined,
      serviceId: undefined,
      clientId: undefined,
      professionalId: undefined,
      search: undefined,
    });
  });
});
