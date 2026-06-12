import { HttpException } from '@nestjs/common';
import { ReservationCommandService } from './reservation-command.service';
import type { AuthUser } from '../../../auth/security/auth-user.type';
import type { Reservation } from '../../domain/entities/reservation.entity';

describe('ReservationCommandService', () => {
  const clientUser: AuthUser = {
    sub: 'client-id',
    role: 'CLIENT',
    phoneNumber: '+221772345678',
  };

  const professionalUser: AuthUser = {
    sub: 'professional-user-id',
    role: 'PRESTATAIRE',
    phoneNumber: '+221773456789',
  };

  const buildReservation = (
    overrides: Partial<Reservation> = {},
  ): Reservation => ({
    id: 'reservation-id',
    clientId: 'client-id',
    professionnelId: 'professional-id',
    serviceId: 'service-id',
    dateHeure: new Date('2026-06-20T10:00:00.000Z'),
    adresseClient: 'Dakar Plateau',
    dureeMinutes: 60,
    statut: 'PAYEE_SEQUESTRE',
    notes: null,
    prixConvenu: 12000,
    statutAjustementPrix: 'AUCUN',
    prixAjustementPropose: null,
    raisonAjustementPrix: null,
    demandeAjustementPrixLe: null,
    raisonAnnulation: null,
    clientRating: null,
    clientReview: null,
    clientReviewedAt: null,
    creeLe: new Date('2026-06-10T10:00:00.000Z'),
    misAJourLe: new Date('2026-06-10T10:00:00.000Z'),
    ...overrides,
  });

  const buildService = (overrides?: {
    reservation?: Reservation;
    professionalId?: string;
  }) => {
    const reservationsRepository = {
      findById: jest
        .fn()
        .mockResolvedValue(overrides?.reservation ?? buildReservation()),
      update: jest.fn(async (reservation: Reservation) => reservation),
      hasPaymentForReservation: jest.fn().mockResolvedValue(false),
    };
    const professionalsRepository = {
      findByUserId: jest.fn().mockResolvedValue({
        id: overrides?.professionalId ?? 'professional-id',
        utilisateur: {
          id: 'professional-user-id',
          nom: 'Prestataire Jokko',
        },
      }),
      findVerifiedById: jest.fn().mockResolvedValue({
        id: 'professional-id',
        utilisateur: {
          id: 'professional-user-id',
          nom: 'Prestataire Jokko',
        },
      }),
      getServiceById: jest.fn().mockResolvedValue({
        id: 'service-id',
        profilProfessionnelId: 'professional-id',
        nom: 'Informatique',
        prix: 15000,
        estDisponible: true,
        typePrix: 'NEGOCIABLE',
      }),
    };
    const eventBus = { publier: jest.fn() };
    const negotiationsFacade = {
      getAcceptedNegotiationForReservation: jest.fn().mockResolvedValue({
        id: 'negotiation-id',
        clientId: 'client-id',
        professionnelId: 'professional-id',
        serviceId: 'service-id',
        statut: 'ACCEPTEE',
        montantCourant: 12000,
        montantAccepte: 12000,
        dateHeureProposee: new Date('2026-06-20T10:00:00.000Z'),
        adresseClientProposee: 'Dakar Plateau',
        dureeMinutesProposee: 60,
      }),
    };
    const reservationClientNotificationService = {
      notifyReservationCreated: jest.fn(),
      notifyReservationConfirmed: jest.fn(),
      notifyPriceAdjustmentProposed: jest.fn(),
    };
    const disputesFacade = {};
    const liveTrackingFacade = {
      finalizeReservationTracking: jest.fn(),
    };

    return {
      service: new ReservationCommandService(
        reservationsRepository as never,
        professionalsRepository as never,
        eventBus as never,
        negotiationsFacade as never,
        reservationClientNotificationService as never,
        disputesFacade as never,
        liveTrackingFacade as never,
      ),
      reservationsRepository,
      professionalsRepository,
    };
  };

  it('rejects reservation conversion when requested details differ from accepted negotiation details', async () => {
    const { service } = buildService();

    try {
      await service.createReservationFromNegotiation(clientUser, {
        negotiationId: 'negotiation-id',
        dateHeure: '2026-06-21T10:00:00.000Z',
        adresseClient: 'Dakar Plateau',
        dureeMinutes: 60,
      });
      throw new Error('Expected reservation conversion to fail.');
    } catch (error) {
      expect(error).toBeInstanceOf(HttpException);
      expect((error as HttpException).getResponse()).toMatchObject({
        errorCode: 'RESERVATIONS_NEGOTIATION_DETAILS_MISMATCH',
      });
    }
  });

  it('rejects paid transition when the requester is not the reservation client', async () => {
    const { service, reservationsRepository } = buildService({
      reservation: buildReservation({
        clientId: 'client-id',
        professionnelId: 'professional-id',
        statut: 'CONFIRMEE',
      }),
    });

    await expect(
      service.markAsPaid(professionalUser, 'reservation-id'),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        errorCode: 'RESERVATIONS_UNAUTHORIZED',
      }),
    });
    expect(reservationsRepository.update).not.toHaveBeenCalled();
  });

  it('rejects provider reservation confirmation because client booking is already confirmed', async () => {
    const { service, reservationsRepository } = buildService({
      reservation: buildReservation({
        clientId: 'professional-user-id',
        professionnelId: 'other-professional-id',
        statut: 'EN_ATTENTE',
      }),
      professionalId: 'professional-id',
    });

    await expect(
      service.confirmReservation(professionalUser, 'reservation-id'),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        errorCode: 'RESERVATIONS_CONFIRMATION_NOT_REQUIRED',
      }),
    });
    expect(reservationsRepository.update).not.toHaveBeenCalled();
  });

  it('rejects no-show transition when the professional does not own the reservation', async () => {
    const { service, reservationsRepository } = buildService({
      reservation: buildReservation({
        clientId: 'professional-user-id',
        professionnelId: 'other-professional-id',
        statut: 'PAYEE_SEQUESTRE',
      }),
      professionalId: 'professional-id',
    });

    await expect(
      service.markNoShow(professionalUser, 'reservation-id'),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        errorCode: 'RESERVATIONS_UNAUTHORIZED',
      }),
    });
    expect(reservationsRepository.update).not.toHaveBeenCalled();
  });

  it('lets the owning professional complete a paid reservation', async () => {
    const { service, reservationsRepository } = buildService({
      reservation: buildReservation({
        clientId: 'client-id',
        professionnelId: 'professional-id',
        statut: 'PAYEE_SEQUESTRE',
      }),
      professionalId: 'professional-id',
    });

    const result = await service.completeReservation(
      professionalUser,
      'reservation-id',
    );

    expect(result.statut).toBe('TERMINEE');
    expect(reservationsRepository.update).toHaveBeenCalledWith(
      expect.objectContaining({ statut: 'TERMINEE' }),
    );
  });
});
