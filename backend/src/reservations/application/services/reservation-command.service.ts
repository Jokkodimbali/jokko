import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import {
  EscrowStatus,
  StatutDevisMateriel,
  StatutPaiement,
} from '@prisma/client';
import { randomUUID } from 'node:crypto';
import type { AuthUser } from '../../../auth/security/auth-user.type';
import {
  DOMAINE_EVENT_BUS,
  type DomaineEventBusPort,
} from '../../../core/events/domaine-event-bus.port';
import { appHttpException } from '../../../core/http/app-http.exception';
import { DomainError } from '../../../shared/domain/errors/domain-error';
import { trimString } from '../../../shared/utils/string.utils';
import {
  PROFESSIONALS_REPOSITORY_PORT,
  type ProfessionalsRepositoryPort,
} from '../../../professionals/application/ports/professionals-repository.port';
import { NegotiationsFacade } from '../../../negotiations/application/services/negotiations-facade.service';
import type {
  CancelReservationCommand,
  CreateReservationCommand,
  CreateReservationFromNegotiationCommand,
  ProposeReservationPriceAdjustmentCommand,
  RescheduleReservationCommand,
  SubmitReservationReviewCommand,
} from '../commands/reservations.commands';
import { ReservationEntity } from '../../domain/entities/reservation.entity';
import {
  RESERVATIONS_REPOSITORY_PORT,
  type ReservationsRepositoryPort,
} from '../ports/reservations-repository.port';
import { ReservationClientNotificationService } from '../../../notifications/application/services/reservation-client-notification.service';
import { ReservationAppService } from './reservation-app-service.base';
import { DisputesFacade } from '../../../disputes/application/services/disputes-facade.service';
import { LiveTrackingFacade } from '../../../live-tracking/application/services/live-tracking-facade.service';
import {
  ProviderArrivedEvent,
  ServiceCompletedEvent,
  ServiceStartedEvent,
} from '../../domain/events/reservation-mission.events';
import { PrismaService } from '../../../prisma/prisma.service';

@Injectable()
export class ReservationCommandService extends ReservationAppService {
  constructor(
    @Inject(RESERVATIONS_REPOSITORY_PORT)
    reservationsRepository: ReservationsRepositoryPort,
    @Inject(PROFESSIONALS_REPOSITORY_PORT)
    professionalsRepository: ProfessionalsRepositoryPort,
    @Inject(DOMAINE_EVENT_BUS)
    private readonly eventBus: DomaineEventBusPort,
    private readonly negotiationsFacade: NegotiationsFacade,
    private readonly reservationClientNotificationService: ReservationClientNotificationService,
    private readonly disputesFacade: DisputesFacade,
    private readonly liveTrackingFacade: LiveTrackingFacade,
    private readonly prisma: PrismaService,
  ) {
    super(reservationsRepository, professionalsRepository);
  }

  async createReservation(
    requestUser: AuthUser,
    command: CreateReservationCommand,
  ) {
    this.assertClientRole(requestUser.role);

    if (requestUser.role === 'PRESTATAIRE' || requestUser.role === 'MEDECIN') {
      const ownProfessionalProfile = await this.getProfessionalProfileOrThrow(
        requestUser.sub,
      );
      if (ownProfessionalProfile.id === command.professionnelId) {
        throw appHttpException('RESERVATIONS_SELF_BOOKING_FORBIDDEN');
      }
    }

    await this.getVerifiedProfessionalOrThrow(command.professionnelId);
    const service = await this.getServiceOrThrow(command.serviceId);

    if (!service.estDisponible) {
      throw appHttpException('RESERVATIONS_SERVICE_NOT_AVAILABLE');
    }

    if (service.profilProfessionnelId !== command.professionnelId) {
      throw appHttpException('RESERVATIONS_SERVICE_PROFESSIONAL_MISMATCH');
    }

    const scheduledAt = this.parseDateOrThrow(command.dateHeure);

    try {
      const reservation = ReservationEntity.create({
        id: randomUUID(),
        clientId: requestUser.sub,
        professionnelId: command.professionnelId,
        serviceId: command.serviceId,
        dateHeure: scheduledAt,
        adresseClient: command.adresseClient,
        dureeMinutes: command.dureeMinutes,
        notes: trimString(command.notes) ?? null,
        prixConvenu: service.prix,
      });

      const createdReservation = await this.reservationsRepository.save(
        reservation.toView(),
      );

      return createdReservation;
    } catch (error) {
      this.handleDomainError(error);
      throw error;
    }
  }

  createReservationFromNegotiation(
    requestUser: AuthUser,
    command: CreateReservationFromNegotiationCommand,
  ) {
    this.assertClientRole(requestUser.role);
    return this.createReservationFromAcceptedNegotiation(requestUser, command);
  }

  confirmReservation(requestUser: AuthUser, reservationId: string) {
    void requestUser;
    void reservationId;
    throw appHttpException('RESERVATIONS_CONFIRMATION_NOT_REQUIRED');
  }

  async cancelReservation(
    requestUser: AuthUser,
    reservationId: string,
    command: CancelReservationCommand,
  ) {
    const reservation = await this.getAccessibleReservationOrThrow(
      requestUser,
      reservationId,
    );

    try {
      const entity = ReservationEntity.reconstitute(reservation);
      entity.cancel(trimString(command.reason) ?? null);
      const updated = await this.reservationsRepository.update(entity.toView());
      await this.refundLockedPaymentOnCancellation(
        updated.id,
        trimString(command.reason) ??
          'Reservation annulee par un utilisateur autorise.',
      );
      await this.liveTrackingFacade.finalizeReservationTracking({
        reservationId: updated.id,
        professionalId: updated.professionnelId,
        trackingStatus: 'ANNULEE',
        nextPresenceStatus: 'EN_LIGNE',
      });
      // Notify client
      const professional = await this.getVerifiedProfessionalOrThrow(
        reservation.professionnelId,
      );
      const service = await this.getServiceOrThrow(reservation.serviceId);
      await this.reservationClientNotificationService.notifyReservationCancelled(
        {
          reservationId: updated.id,
          clientId: updated.clientId,
          serviceName: service.nom,
          professionalName: professional.utilisateur.nom,
          dateHeure: updated.dateHeure,
          adresseClient: updated.adresseClient,
        },
      );
      if (requestUser.sub === updated.clientId) {
        const detailedReservation =
          await this.reservationsRepository.findDetailedById(updated.id);
        await this.reservationClientNotificationService.notifyReservationCancelledForProfessional(
          {
            reservationId: updated.id,
            professionalUserId: professional.utilisateur.id,
            clientName: detailedReservation?.client.nom ?? 'Le client',
            serviceName: service.nom,
            dateHeure: updated.dateHeure,
            reason: updated.raisonAnnulation,
          },
        );
      }

      return updated;
    } catch (error) {
      this.handleDomainError(error);
      throw error;
    }
  }

  private async refundLockedPaymentOnCancellation(
    reservationId: string,
    reason: string,
  ): Promise<void> {
    await this.prisma.paiement.updateMany({
      where: {
        reservationId,
        statut: StatutPaiement.SUCCES,
        escrowStatus: EscrowStatus.LOCKED,
      },
      data: {
        statut: StatutPaiement.REMBOURSE,
        escrowStatus: EscrowStatus.REFUNDED,
        raisonRemboursement: reason,
        misAJourLe: new Date(),
      },
    });
  }

  async rescheduleReservation(
    requestUser: AuthUser,
    reservationId: string,
    command: RescheduleReservationCommand,
  ) {
    const reservation = await this.getAccessibleReservationOrThrow(
      requestUser,
      reservationId,
    );
    const newDateTime = this.parseDateOrThrow(command.newDateTime);

    try {
      const entity = ReservationEntity.reconstitute(reservation);
      entity.reschedule(newDateTime);
      return await this.reservationsRepository.update(entity.toView());
    } catch (error) {
      this.handleDomainError(error);
      throw error;
    }
  }

  async proposePriceAdjustment(
    requestUser: AuthUser,
    reservationId: string,
    command: ProposeReservationPriceAdjustmentCommand,
  ) {
    this.assertProfessionalRole(requestUser.role);
    const reservation = await this.getAccessibleReservationOrThrow(
      requestUser,
      reservationId,
    );
    const professional = await this.assertProfessionalOwnsReservation(
      requestUser,
      reservation,
    );

    if (
      await this.reservationsRepository.hasPaymentForReservation(reservationId)
    ) {
      throw appHttpException(
        'RESERVATIONS_PRICE_ADJUSTMENT_FORBIDDEN_AFTER_PAYMENT',
      );
    }

    try {
      const entity = ReservationEntity.reconstitute(reservation);
      entity.proposePriceAdjustment({
        proposedPrice: command.proposedPrice,
        reason: trimString(command.reason) ?? null,
      });
      const updated = await this.reservationsRepository.update(entity.toView());
      const service = await this.getServiceOrThrow(updated.serviceId);
      await this.reservationClientNotificationService.notifyPriceAdjustmentProposed(
        {
          reservationId: updated.id,
          clientId: updated.clientId,
          serviceName: service.nom,
          professionalName: professional.utilisateur.nom,
          dateHeure: updated.dateHeure,
          adresseClient: updated.adresseClient,
          currentPrice: reservation.prixConvenu,
          proposedPrice: updated.prixAjustementPropose ?? command.proposedPrice,
          reason: updated.raisonAjustementPrix,
        },
      );

      return updated;
    } catch (error) {
      this.handleDomainError(error);
      throw error;
    }
  }

  async acceptPriceAdjustment(requestUser: AuthUser, reservationId: string) {
    this.assertClientRole(requestUser.role);
    const reservation = await this.getAccessibleReservationOrThrow(
      requestUser,
      reservationId,
    );
    if (reservation.clientId !== requestUser.sub) {
      throw appHttpException('RESERVATIONS_UNAUTHORIZED');
    }

    if (
      await this.reservationsRepository.hasPaymentForReservation(reservationId)
    ) {
      throw appHttpException(
        'RESERVATIONS_PRICE_ADJUSTMENT_FORBIDDEN_AFTER_PAYMENT',
      );
    }

    try {
      const entity = ReservationEntity.reconstitute(reservation);
      entity.acceptPriceAdjustment();
      const updated = await this.reservationsRepository.update(entity.toView());
      const professional = await this.getVerifiedProfessionalOrThrow(
        updated.professionnelId,
      );
      const service = await this.getServiceOrThrow(updated.serviceId);
      await this.reservationClientNotificationService.notifyPriceAdjustmentAccepted(
        {
          reservationId: updated.id,
          professionalUserId: professional.utilisateur.id,
          serviceName: service.nom,
          proposedPrice: updated.prixConvenu ?? 0,
        },
      );

      return updated;
    } catch (error) {
      this.handleDomainError(error);
      throw error;
    }
  }

  async rejectPriceAdjustment(requestUser: AuthUser, reservationId: string) {
    this.assertClientRole(requestUser.role);
    const reservation = await this.getAccessibleReservationOrThrow(
      requestUser,
      reservationId,
    );
    if (reservation.clientId !== requestUser.sub) {
      throw appHttpException('RESERVATIONS_UNAUTHORIZED');
    }

    if (
      await this.reservationsRepository.hasPaymentForReservation(reservationId)
    ) {
      throw appHttpException(
        'RESERVATIONS_PRICE_ADJUSTMENT_FORBIDDEN_AFTER_PAYMENT',
      );
    }

    try {
      const entity = ReservationEntity.reconstitute(reservation);
      const proposedPrice = reservation.prixAjustementPropose ?? 0;
      entity.rejectPriceAdjustment();
      const updated = await this.reservationsRepository.update(entity.toView());
      const professional = await this.getVerifiedProfessionalOrThrow(
        updated.professionnelId,
      );
      const service = await this.getServiceOrThrow(updated.serviceId);
      await this.reservationClientNotificationService.notifyPriceAdjustmentRejected(
        {
          reservationId: updated.id,
          professionalUserId: professional.utilisateur.id,
          serviceName: service.nom,
          proposedPrice,
        },
      );

      return updated;
    } catch (error) {
      this.handleDomainError(error);
      throw error;
    }
  }

  async completeReservation(requestUser: AuthUser, reservationId: string) {
    this.assertProfessionalRole(requestUser.role);
    const reservation = await this.getAccessibleReservationOrThrow(
      requestUser,
      reservationId,
    );
    await this.assertProfessionalOwnsReservation(requestUser, reservation);

    try {
      const entity = ReservationEntity.reconstitute(reservation);
      entity.markAsCompleted();
      const updated = await this.reservationsRepository.update(entity.toView());
      await this.liveTrackingFacade.finalizeReservationTracking({
        reservationId: updated.id,
        professionalId: updated.professionnelId,
        trackingStatus: 'TERMINEE',
        nextPresenceStatus: 'EN_LIGNE',
      });
      await this.eventBus.publier(
        new ServiceCompletedEvent({
          reservationId: updated.id,
          clientUserId: updated.clientId,
          professionalId: updated.professionnelId,
        }),
      );

      return updated;
    } catch (error) {
      this.handleDomainError(error);
      throw error;
    }
  }

  async submitReview(
    requestUser: AuthUser,
    reservationId: string,
    command: SubmitReservationReviewCommand,
  ) {
    this.assertClientRole(requestUser.role);
    const reservation = await this.getAccessibleReservationOrThrow(
      requestUser,
      reservationId,
    );

    if (reservation.clientId !== requestUser.sub) {
      throw appHttpException('RESERVATIONS_UNAUTHORIZED');
    }

    try {
      const entity = ReservationEntity.reconstitute(reservation);
      entity.submitClientReview({
        rating: command.rating,
        review: trimString(command.review) ?? null,
      });
      return await this.reservationsRepository.submitClientReview(
        entity.toView(),
      );
    } catch (error) {
      this.handleDomainError(error);
      throw error;
    }
  }

  async markNoShow(requestUser: AuthUser, reservationId: string) {
    this.assertProfessionalRole(requestUser.role);
    const reservation = await this.getAccessibleReservationOrThrow(
      requestUser,
      reservationId,
    );
    await this.assertProfessionalOwnsReservation(requestUser, reservation);

    try {
      const entity = ReservationEntity.reconstitute(reservation);
      entity.markAsNoShow();
      const updated = await this.reservationsRepository.update(entity.toView());
      await this.liveTrackingFacade.finalizeReservationTracking({
        reservationId: updated.id,
        professionalId: updated.professionnelId,
        trackingStatus: 'ANNULEE',
        nextPresenceStatus: 'EN_LIGNE',
      });
      return updated;
    } catch (error) {
      this.handleDomainError(error);
      throw error;
    }
  }

  async markAsPaid(requestUser: AuthUser, reservationId: string) {
    this.assertClientRole(requestUser.role);
    const reservation = await this.getAccessibleReservationOrThrow(
      requestUser,
      reservationId,
    );
    if (reservation.clientId !== requestUser.sub) {
      throw appHttpException('RESERVATIONS_UNAUTHORIZED');
    }

    try {
      const entity = ReservationEntity.reconstitute(reservation);
      entity.markAsPaid();
      return await this.reservationsRepository.update(entity.toView());
    } catch (error) {
      this.handleDomainError(error);
      throw error;
    }
  }

  async startReservation(requestUser: AuthUser, reservationId: string) {
    this.assertProfessionalRole(requestUser.role);
    const reservation = await this.getAccessibleReservationOrThrow(
      requestUser,
      reservationId,
    );
    await this.assertProfessionalOwnsReservation(requestUser, reservation);
    await this.assertTravelerArrivedBeforeStart(requestUser, reservationId);

    try {
      const entity = ReservationEntity.reconstitute(reservation);
      entity.startReservation();
      const updated = await this.reservationsRepository.update(entity.toView());
      await this.liveTrackingFacade.finalizeReservationTracking({
        reservationId: updated.id,
        professionalId: updated.professionnelId,
        trackingStatus: 'TERMINEE',
        nextPresenceStatus: 'EN_PRESTATION',
      });
      await this.eventBus.publier(
        new ProviderArrivedEvent({
          reservationId: updated.id,
          clientUserId: updated.clientId,
          professionalId: updated.professionnelId,
        }),
      );
      await this.eventBus.publier(
        new ServiceStartedEvent({
          reservationId: updated.id,
          clientUserId: updated.clientId,
          professionalId: updated.professionnelId,
        }),
      );
      return updated;
    } catch (error) {
      this.handleDomainError(error);
      throw error;
    }
  }

  private async assertTravelerArrivedBeforeStart(
    requestUser: AuthUser,
    reservationId: string,
  ): Promise<void> {
    const tracking = await this.liveTrackingFacade.getReservationTracking(
      requestUser,
      reservationId,
    );
    if (tracking.trackingStatus !== 'EN_ROUTE') {
      throw appHttpException('RESERVATIONS_ARRIVAL_REQUIRED');
    }
  }

  async openDispute(
    requestUser: AuthUser,
    reservationId: string,
    reason: string,
  ) {
    const reservation = await this.getAccessibleReservationOrThrow(
      requestUser,
      reservationId,
    );

    try {
      const entity = ReservationEntity.reconstitute(reservation);
      entity.openDispute(reason);
      const updated = await this.reservationsRepository.update(entity.toView());
      await this.liveTrackingFacade.finalizeReservationTracking({
        reservationId: updated.id,
        professionalId: updated.professionnelId,
        trackingStatus: 'ANNULEE',
        nextPresenceStatus: 'EN_LIGNE',
      });
      const paymentId =
        await this.reservationsRepository.findPaymentIdForReservation(
          reservationId,
        );
      await this.disputesFacade.openForReservation({
        reservationId: updated.id,
        reporterUserId: requestUser.sub,
        paymentId,
        reason,
      });
      return updated;
    } catch (error) {
      this.handleDomainError(error);
      throw error;
    }
  }

  private handleDomainError(error: unknown): never | void {
    if (!(error instanceof DomainError)) {
      return;
    }

    // Since ReservationDomainError extends appHttpException, just re-throw
    throw error;
  }

  private async assertProfessionalOwnsReservation(
    requestUser: AuthUser,
    reservation: { professionnelId: string },
  ) {
    const professional = await this.getProfessionalProfileOrThrow(
      requestUser.sub,
    );
    if (reservation.professionnelId !== professional.id) {
      throw appHttpException('RESERVATIONS_UNAUTHORIZED');
    }

    return professional;
  }

  private async createReservationFromAcceptedNegotiation(
    requestUser: AuthUser,
    command: CreateReservationFromNegotiationCommand,
  ) {
    const negotiation =
      await this.negotiationsFacade.getAcceptedNegotiationForReservation(
        requestUser,
        command.negotiationId,
      );
    await this.getVerifiedProfessionalOrThrow(negotiation.professionnelId);
    await this.getServiceOrThrow(negotiation.serviceId);
    const details = this.resolveAcceptedNegotiationReservationDetails(
      negotiation,
      command,
    );
    const scheduledAt = this.parseDateOrThrow(details.dateHeure);
    const pendingMaterialQuote = await this.prisma.devisMaterielNegotiation.findFirst({
      where: {
        negotiationId: negotiation.id,
        statut: StatutDevisMateriel.EN_ATTENTE,
      },
      select: { id: true },
    });
    if (pendingMaterialQuote) {
      throw new BadRequestException(
        'Le devis materiel doit etre valide ou refuse avant de finaliser la reservation.',
      );
    }

    try {
      const reservation = ReservationEntity.create({
        id: randomUUID(),
        clientId: requestUser.sub,
        professionnelId: negotiation.professionnelId,
        serviceId: negotiation.serviceId,
        dateHeure: scheduledAt,
        adresseClient: details.adresseClient,
        dureeMinutes: details.dureeMinutes,
        notes: trimString(command.notes) ?? null,
        prixConvenu: negotiation.montantAccepte ?? negotiation.montantCourant,
      });

      const createdReservation =
        await this.reservationsRepository.saveFromNegotiation(
          reservation.toView(),
          negotiation.id,
        );
      if (!createdReservation) {
        throw appHttpException('NEGOTIATIONS_ALREADY_CONVERTED');
      }

      await this.eventBus.publier({
        nom: 'negotiations.converted',
        dateOccurrence: new Date(),
        payload: {
          negotiationId: negotiation.id,
          reservationId: createdReservation.id,
          clientId: createdReservation.clientId,
          professionalId: createdReservation.professionnelId,
          amount: negotiation.montantAccepte ?? negotiation.montantCourant,
        },
      });

      return createdReservation;
    } catch (error) {
      this.handleDomainError(error);
      throw error;
    }
  }

  private resolveAcceptedNegotiationReservationDetails(
    negotiation: {
      dateHeureProposee: Date | string | null;
      adresseClientProposee: string | null;
      dureeMinutesProposee: number | null;
    },
    command: CreateReservationFromNegotiationCommand,
  ): {
    dateHeure: string;
    adresseClient: string;
    dureeMinutes: number;
  } {
    const negotiatedDate = negotiation.dateHeureProposee
      ? new Date(negotiation.dateHeureProposee)
      : null;
    const requestedDate = this.parseDateOrThrow(command.dateHeure);

    if (
      negotiatedDate &&
      !Number.isNaN(negotiatedDate.getTime()) &&
      negotiatedDate.getTime() !== requestedDate.getTime()
    ) {
      throw appHttpException('RESERVATIONS_NEGOTIATION_DETAILS_MISMATCH');
    }

    const negotiatedAddress = trimString(negotiation.adresseClientProposee);
    const requestedAddress = trimString(command.adresseClient);
    if (
      negotiatedAddress &&
      requestedAddress &&
      negotiatedAddress.toLowerCase() !== requestedAddress.toLowerCase()
    ) {
      throw appHttpException('RESERVATIONS_NEGOTIATION_DETAILS_MISMATCH');
    }

    if (
      negotiation.dureeMinutesProposee !== null &&
      negotiation.dureeMinutesProposee !== command.dureeMinutes
    ) {
      throw appHttpException('RESERVATIONS_NEGOTIATION_DETAILS_MISMATCH');
    }

    return {
      dateHeure:
        negotiatedDate && !Number.isNaN(negotiatedDate.getTime())
          ? negotiatedDate.toISOString()
          : command.dateHeure,
      adresseClient:
        negotiatedAddress ?? requestedAddress ?? command.adresseClient,
      dureeMinutes: negotiation.dureeMinutesProposee ?? command.dureeMinutes,
    };
  }
}
