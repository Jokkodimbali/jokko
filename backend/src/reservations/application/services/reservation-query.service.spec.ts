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
      hasTimeSlotConflict: jest.fn().mockResolvedValue(false),
    } as unknown as jest.Mocked<ReservationsRepositoryPort>;

    const professionalsRepository = {
      findByUserId: jest.fn().mockResolvedValue({
        id: 'professional-id',
        userId: professionalUser.sub,
      }),
      findVerifiedById: jest.fn().mockResolvedValue({
        id: 'professional-id',
        userId: professionalUser.sub,
      }),
      listAvailabilities: jest.fn().mockResolvedValue([
        {
          id: 'availability-id',
          profilProfessionnelId: 'professional-id',
          jourSemaine: 2,
          heureDebut: new Date('1970-01-01T09:00:00.000Z'),
          heureFin: new Date('1970-01-01T12:00:00.000Z'),
          estActive: true,
        },
      ]),
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

  it('generates availability slots using the requested appointment duration', async () => {
    const { service, reservationsRepository } = buildService();

    const result = await service.listAvailabilitySlots({
      professionalId: 'professional-id',
      date: '2030-01-01',
      dureeMinutes: 60,
    });

    expect(result.slots.map((slot) => slot.label)).toEqual([
      '09:00',
      '10:00',
      '11:00',
    ]);
    expect(reservationsRepository.hasTimeSlotConflict).toHaveBeenCalledTimes(3);
  });
});
