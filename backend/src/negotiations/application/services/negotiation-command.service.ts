import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { AuthUser } from '../../../auth/security/auth-user.type';
import {
  DOMAINE_EVENT_BUS,
  type DomaineEventBusPort,
} from '../../../core/events/domaine-event-bus.port';
import { appHttpException } from '../../../core/http/app-http.exception';
import {
  NEGOTIATIONS_REPOSITORY_PORT,
  type NegotiationsRepositoryPort,
} from '../ports/negotiations-repository.port';
import {
  PROFESSIONALS_REPOSITORY_PORT,
  type ProfessionalsRepositoryPort,
} from '../../../professionals/application/ports/professionals-repository.port';
import type {
  CancelNegotiationCommand,
  CounterNegotiationCommand,
  CreateNegotiationCommand,
  RejectNegotiationCommand,
} from '../commands/negotiations.commands';
import { NegotiationDomainError, NegotiationEntity } from '../../domain';
import { NegotiationAppService } from './negotiation-app-service.base';

@Injectable()
export class NegotiationCommandService extends NegotiationAppService {
  constructor(
    @Inject(NEGOTIATIONS_REPOSITORY_PORT)
    negotiationsRepository: NegotiationsRepositoryPort,
    @Inject(PROFESSIONALS_REPOSITORY_PORT)
    professionalsRepository: ProfessionalsRepositoryPort,
    @Inject(DOMAINE_EVENT_BUS)
    private readonly eventBus: DomaineEventBusPort,
  ) {
    super(negotiationsRepository, professionalsRepository);
  }

  async createNegotiation(
    requestUser: AuthUser,
    command: CreateNegotiationCommand,
  ) {
    this.assertClientRole(requestUser.role);

    if (requestUser.role === 'PRESTATAIRE') {
      const ownProfile = await this.getProfessionalProfileOrThrow(
        requestUser.sub,
      );
      const service = await this.getServiceOrThrow(command.serviceId);
      if (service.profilProfessionnelId === ownProfile.id) {
        throw appHttpException('NEGOTIATIONS_SELF_NEGOTIATION_FORBIDDEN');
      }
    }

    const service = await this.getServiceOrThrow(command.serviceId);
    if (!service.estDisponible) {
      throw appHttpException('RESERVATIONS_SERVICE_NOT_AVAILABLE');
    }

    if (service.typePrix !== 'NEGOCIABLE') {
      throw appHttpException('NEGOTIATIONS_SERVICE_NOT_NEGOTIABLE');
    }

    const professional = await this.professionalsRepository.findVerifiedById(
      service.profilProfessionnelId,
    );
    if (!professional) {
      throw appHttpException('RESERVATIONS_PROFESSIONAL_NOT_FOUND');
    }

    const entity = NegotiationEntity.create({
      id: randomUUID(),
      clientId: requestUser.sub,
      professionnelId: professional.id,
      serviceId: command.serviceId,
      montantInitial: command.proposedAmount,
      messageCourant: command.message,
      offreId: randomUUID(),
    });

    const created = await this.negotiationsRepository.createIfNoActive(
      this.toCreateInput(entity),
    );
    if (!created) {
      const existing =
        await this.negotiationsRepository.findActiveByClientAndService(
          requestUser.sub,
          command.serviceId,
        );
      if (existing) {
        const existingNegotiation = await this.negotiationsRepository.findById(
          existing.id,
        );
        if (existingNegotiation) {
          return existingNegotiation;
        }
      }

      throw appHttpException('NEGOTIATIONS_ALREADY_ACTIVE');
    }
    await this.publishEvents(entity);
    return created;
  }

  async counterNegotiation(
    requestUser: AuthUser,
    negotiationId: string,
    command: CounterNegotiationCommand,
  ) {
    const entity = await this.getAuthorizedEntityOrThrow(
      requestUser,
      negotiationId,
    );

    try {
      if (requestUser.role === 'PRESTATAIRE') {
        entity.counterByProfessional({
          offerId: randomUUID(),
          amount: command.proposedAmount,
          message: command.message,
        });
      } else {
        entity.counterByClient({
          offerId: randomUUID(),
          amount: command.proposedAmount,
          message: command.message,
        });
      }
    } catch (error) {
      this.handleDomainError(error);
      throw error;
    }

    const updated = await this.negotiationsRepository.update(
      this.toUpdateInput(entity),
    );
    entity.clearPendingOffer();
    await this.publishEvents(entity);
    return updated;
  }

  async acceptNegotiation(requestUser: AuthUser, negotiationId: string) {
    const entity = await this.getAuthorizedEntityOrThrow(
      requestUser,
      negotiationId,
    );

    try {
      if (requestUser.role === 'PRESTATAIRE') {
        entity.acceptByProfessional();
      } else {
        entity.acceptByClient();
      }
    } catch (error) {
      this.handleDomainError(error);
      throw error;
    }

    const updated = await this.negotiationsRepository.update(
      this.toUpdateInput(entity),
    );
    entity.clearPendingOffer();
    await this.publishEvents(entity);
    return updated;
  }

  async rejectNegotiation(
    requestUser: AuthUser,
    negotiationId: string,
    command: RejectNegotiationCommand,
  ) {
    this.assertProfessionalRole(requestUser.role);
    const entity = await this.getAuthorizedEntityOrThrow(
      requestUser,
      negotiationId,
    );

    try {
      entity.rejectByProfessional(command.reason);
    } catch (error) {
      this.handleDomainError(error);
      throw error;
    }

    const updated = await this.negotiationsRepository.update(
      this.toUpdateInput(entity),
    );
    entity.clearPendingOffer();
    await this.publishEvents(entity);
    return updated;
  }

  async cancelNegotiation(
    requestUser: AuthUser,
    negotiationId: string,
    command: CancelNegotiationCommand,
  ) {
    this.assertClientRole(requestUser.role);
    const entity = await this.getAuthorizedEntityOrThrow(
      requestUser,
      negotiationId,
    );

    try {
      entity.cancelByClient(command.reason);
    } catch (error) {
      this.handleDomainError(error);
      throw error;
    }

    const updated = await this.negotiationsRepository.update(
      this.toUpdateInput(entity),
    );
    entity.clearPendingOffer();
    await this.publishEvents(entity);
    return updated;
  }

  private async getAuthorizedEntityOrThrow(
    requestUser: AuthUser,
    negotiationId: string,
  ): Promise<NegotiationEntity> {
    const negotiation = await this.getNegotiationOrThrow(negotiationId);

    if (requestUser.role === 'PRESTATAIRE') {
      const profile = await this.getProfessionalProfileOrThrow(requestUser.sub);
      if (profile.id !== negotiation.professionnelId) {
        throw appHttpException('NEGOTIATIONS_UNAUTHORIZED');
      }
    } else if (negotiation.clientId !== requestUser.sub) {
      throw appHttpException('NEGOTIATIONS_UNAUTHORIZED');
    }

    return NegotiationEntity.reconstitute(negotiation);
  }

  private toCreateInput(entity: NegotiationEntity) {
    const view = entity.toView();
    const [initialOffer] = view.propositions;
    return {
      id: view.id,
      clientId: view.clientId,
      professionnelId: view.professionnelId,
      serviceId: view.serviceId,
      statut: view.statut,
      montantInitial: view.montantInitial,
      montantCourant: view.montantCourant,
      montantAccepte: view.montantAccepte,
      dernierProposePar: view.dernierProposePar,
      messageCourant: view.messageCourant,
      raisonCloture: view.raisonCloture,
      reservationId: view.reservationId,
      creeLe: view.creeLe,
      misAJourLe: view.misAJourLe,
      initialOffer: {
        id: initialOffer.id,
        proposePar: initialOffer.proposePar,
        montant: initialOffer.montant,
        message: initialOffer.message,
        creeLe: initialOffer.creeLe,
      },
    };
  }

  private toUpdateInput(entity: NegotiationEntity) {
    const view = entity.toView();
    const pendingOffer = entity.getPendingOffer();

    return {
      id: view.id,
      statut: view.statut,
      montantCourant: view.montantCourant,
      montantAccepte: view.montantAccepte,
      dernierProposePar: view.dernierProposePar,
      messageCourant: view.messageCourant,
      raisonCloture: view.raisonCloture,
      reservationId: view.reservationId,
      misAJourLe: view.misAJourLe,
      newOffer: pendingOffer
        ? {
            id: pendingOffer.id,
            proposePar: pendingOffer.proposePar,
            montant: pendingOffer.montant,
            message: pendingOffer.message,
            creeLe: pendingOffer.creeLe,
          }
        : undefined,
    };
  }

  private async publishEvents(entity: NegotiationEntity): Promise<void> {
    for (const event of entity.getDomainEvents()) {
      await this.eventBus.publier({
        nom: event.name,
        dateOccurrence: new Date(),
        payload: event,
      });
    }
    entity.clearDomainEvents();
  }

  private handleDomainError(error: unknown): void {
    if (!(error instanceof NegotiationDomainError)) {
      return;
    }

    throw appHttpException(error.code as never);
  }
}
