import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { AuthUser } from '../../../auth/security/auth-user.type';
import { appHttpException } from '../../../core/http/app-http.exception';
import { DomainError } from '../../../shared/domain/errors/domain-error';
import { trimString } from '../../../shared/utils/string.utils';
import {
  PROFESSIONALS_REPOSITORY_PORT,
  type ProfessionalsRepositoryPort,
} from '../../../professionals/application/ports/professionals-repository.port';
import type {
  CancelReservationCommand,
  CreateReservationCommand,
  CreateReservationFromNegotiationCommand,
  RescheduleReservationCommand,
} from '../commands/reservations.commands';
import { ReservationEntity } from '../../domain/entities/reservation.entity';
import {
  RESERVATIONS_REPOSITORY_PORT,
  type ReservationsRepositoryPort,
} from '../ports/reservations-repository.port';
import { ReservationClientNotificationService } from './reservation-client-notification.service';
import { ReservationAppService } from './reservation-app-service.base';

@Injectable()
export class ReservationCommandService extends ReservationAppService {
  constructor(
    @Inject(RESERVATIONS_REPOSITORY_PORT)
    reservationsRepository: ReservationsRepositoryPort,
    @Inject(PROFESSIONALS_REPOSITORY_PORT)
    professionalsRepository: ProfessionalsRepositoryPort,
    private readonly reservationClientNotificationService: ReservationClientNotificationService,
  ) {
    super(reservationsRepository, professionalsRepository);
  }

  async createReservation(
    requestUser: AuthUser,
    command: CreateReservationCommand,
  ) {
    this.assertClientRole(requestUser.role);

    if (requestUser.role === 'PRESTATAIRE') {
      const ownProfessionalProfile = await this.getProfessionalProfileOrThrow(
        requestUser.sub,
      );
      if (ownProfessionalProfile.id === command.professionnelId) {
        throw appHttpException('RESERVATIONS_SELF_BOOKING_FORBIDDEN');
      }
    }

    const professional = await this.getVerifiedProfessionalOrThrow(
      command.professionnelId,
    );
    const service = await this.getServiceOrThrow(command.serviceId);

    if (!service.estDisponible) {
      throw appHttpException('RESERVATIONS_SERVICE_NOT_AVAILABLE');
    }

    if (service.profilProfessionnelId !== command.professionnelId) {
      throw appHttpException('RESERVATIONS_SERVICE_PROFESSIONAL_MISMATCH');
    }

    if (service.typePrix === 'NEGOCIABLE') {
      throw appHttpException('RESERVATIONS_NEGOTIATION_REQUIRED');
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
      await this.reservationClientNotificationService.notifyReservationCreated({
        reservationId: createdReservation.id,
        clientId: createdReservation.clientId,
        serviceName: service.nom,
        professionalName: professional.utilisateur.nom,
        dateHeure: createdReservation.dateHeure,
        adresseClient: createdReservation.adresseClient,
      });

      return createdReservation;
    } catch (error) {
      this.handleDomainError(error);
      throw error;
    }
  }

  createReservationFromNegotiation(
    requestUser: AuthUser,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _command: CreateReservationFromNegotiationCommand,
  ): Promise<never> {
    this.assertClientRole(requestUser.role);
    return Promise.reject(
      appHttpException('RESERVATIONS_NEGOTIATION_NOT_AVAILABLE'),
    );
  }

  async confirmReservation(requestUser: AuthUser, reservationId: string) {
    this.assertProfessionalRole(requestUser.role);
    const reservation = await this.getAccessibleReservationOrThrow(
      requestUser,
      reservationId,
    );

    try {
      const entity = ReservationEntity.reconstitute(reservation);
      entity.confirm();
      return await this.reservationsRepository.update(entity.toView());
    } catch (error) {
      this.handleDomainError(error);
      throw error;
    }
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
      return await this.reservationsRepository.update(entity.toView());
    } catch (error) {
      this.handleDomainError(error);
      throw error;
    }
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

  async completeReservation(requestUser: AuthUser, reservationId: string) {
    this.assertClientRole(requestUser.role);
    const reservation = await this.getAccessibleReservationOrThrow(
      requestUser,
      reservationId,
    );

    try {
      const entity = ReservationEntity.reconstitute(reservation);
      entity.markAsCompleted();
      return await this.reservationsRepository.update(entity.toView());
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

    try {
      const entity = ReservationEntity.reconstitute(reservation);
      entity.markAsNoShow();
      return await this.reservationsRepository.update(entity.toView());
    } catch (error) {
      this.handleDomainError(error);
      throw error;
    }
  }

  private handleDomainError(error: unknown): never | void {
    if (!(error instanceof DomainError)) {
      return;
    }

    switch (error.code) {
      case 'RESERVATION_PAST_DATETIME':
      case 'RESERVATION_INVALID_DURATION':
      case 'RESERVATION_INVALID_DATETIME':
      case 'RESERVATION_CLIENT_REQUIRED':
      case 'RESERVATION_PROFESSIONAL_REQUIRED':
      case 'RESERVATION_SERVICE_REQUIRED':
      case 'RESERVATION_ADDRESS_REQUIRED':
        throw appHttpException('VALIDATION_REQUEST_INVALID');
      case 'RESERVATION_NOT_PENDING':
        throw appHttpException('RESERVATIONS_STATUS_PENDING_REQUIRED');
      case 'RESERVATION_NOT_ACTIVE':
        throw appHttpException('RESERVATIONS_STATUS_ACTIVE_REQUIRED');
      case 'RESERVATION_ALREADY_CLOSED':
        throw appHttpException('RESERVATIONS_ALREADY_CLOSED');
      case 'RESERVATION_CANNOT_CANCEL':
        throw appHttpException('RESERVATIONS_ALREADY_CLOSED');
      case 'RESERVATION_CANNOT_RESCHEDULE':
        throw appHttpException('RESERVATIONS_STATUS_ACTIVE_REQUIRED');
      case 'RESERVATION_TIME_SLOT_UNAVAILABLE':
        throw appHttpException('RESERVATIONS_TIME_SLOT_UNAVAILABLE');
      default:
        return;
    }
  }
}
