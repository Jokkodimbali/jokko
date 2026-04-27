import { Injectable } from '@nestjs/common';
import type { AuthUser } from '../../../auth/security/auth-user.type';
import type {
  CancelNegotiationCommand,
  CounterNegotiationCommand,
  CreateNegotiationCommand,
  ListNegotiationsQuery,
  RejectNegotiationCommand,
} from '../commands/negotiations.commands';
import { NegotiationCommandService } from './negotiation-command.service';
import { NegotiationQueryService } from './negotiation-query.service';

@Injectable()
export class NegotiationsFacade {
  constructor(
    private readonly negotiationCommandService: NegotiationCommandService,
    private readonly negotiationQueryService: NegotiationQueryService,
  ) {}

  async createNegotiation(
    requestUser: AuthUser,
    command: CreateNegotiationCommand,
  ) {
    return this.negotiationCommandService.createNegotiation(
      requestUser,
      command,
    );
  }

  async listMyNegotiations(
    requestUser: AuthUser,
    query: ListNegotiationsQuery,
  ) {
    return this.negotiationQueryService.listMyNegotiations(requestUser, query);
  }

  async getNegotiationById(requestUser: AuthUser, negotiationId: string) {
    return this.negotiationQueryService.getNegotiationById(
      requestUser,
      negotiationId,
    );
  }

  async counterNegotiation(
    requestUser: AuthUser,
    negotiationId: string,
    command: CounterNegotiationCommand,
  ) {
    return this.negotiationCommandService.counterNegotiation(
      requestUser,
      negotiationId,
      command,
    );
  }

  async acceptNegotiation(requestUser: AuthUser, negotiationId: string) {
    return this.negotiationCommandService.acceptNegotiation(
      requestUser,
      negotiationId,
    );
  }

  async rejectNegotiation(
    requestUser: AuthUser,
    negotiationId: string,
    command: RejectNegotiationCommand,
  ) {
    return this.negotiationCommandService.rejectNegotiation(
      requestUser,
      negotiationId,
      command,
    );
  }

  async cancelNegotiation(
    requestUser: AuthUser,
    negotiationId: string,
    command: CancelNegotiationCommand,
  ) {
    return this.negotiationCommandService.cancelNegotiation(
      requestUser,
      negotiationId,
      command,
    );
  }

  async getAcceptedNegotiationForReservation(
    requestUser: AuthUser,
    negotiationId: string,
  ) {
    return this.negotiationQueryService.getAcceptedNegotiationForReservation(
      requestUser,
      negotiationId,
    );
  }
}
