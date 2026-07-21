import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { ConfigService } from '@nestjs/config';
import { Inject } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { OnEvent } from '@nestjs/event-emitter';
import { Server, Socket } from 'socket.io';
import type { AuthUser } from '../../../auth/security/auth-user.type';
import { buildSocketCorsOptionsFromProcessEnv } from '../../../core/config/cors.config';
import {
  NEGOTIATIONS_REPOSITORY_PORT,
  type NegotiationView,
  type NegotiationsRepositoryPort,
} from '../../application/ports/negotiations-repository.port';
import {
  PROFESSIONALS_REPOSITORY_PORT,
  type ProfessionalsRepositoryPort,
} from '../../../professionals/application/ports/professionals-repository.port';

type AuthenticatedSocket = Socket & {
  data: {
    user?: AuthUser;
  };
};

type NegotiationDomainEventEnvelope = {
  nom: string;
  payload: {
    negotiationId: string;
    clientId: string;
    professionalId: string;
  };
  dateOccurrence: Date;
};

@WebSocketGateway({
  namespace: '/socket',
  cors: buildSocketCorsOptionsFromProcessEnv(),
})
export class NegotiationsGateway implements OnGatewayConnection {
  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    @Inject(NEGOTIATIONS_REPOSITORY_PORT)
    private readonly negotiationsRepository: NegotiationsRepositoryPort,
    @Inject(PROFESSIONALS_REPOSITORY_PORT)
    private readonly professionalsRepository: ProfessionalsRepositoryPort,
  ) {}

  async handleConnection(client: AuthenticatedSocket): Promise<void> {
    const token = this.extractToken(client);
    if (!token) {
      client.disconnect();
      return;
    }

    try {
      const user = await this.jwtService.verifyAsync<AuthUser>(token, {
        secret: this.configService.get<string>('JWT_ACCESS_SECRET'),
      });
      this.setSocketUser(client, user);
      await client.join(this.buildUserRoom(user.sub));
    } catch {
      client.disconnect();
    }
  }

  @SubscribeMessage('negotiations.subscribe')
  async handleSubscribe(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: { scope?: 'CLIENT' | 'PRESTATAIRE' },
  ) {
    const user = this.getSocketUser(client);
    if (!user) {
      client.disconnect();
      return;
    }

    if (
      payload?.scope === 'PRESTATAIRE' &&
      (user.role === 'PRESTATAIRE' || user.role === 'MEDECIN')
    ) {
      const professional = await this.professionalsRepository.findByUserId(
        user.sub,
      );
      if (professional) {
        await client.join(this.buildProfessionalRoom(professional.id));
      }
    }

    return {
      event: 'negotiations.subscribed',
      data: { scope: payload?.scope ?? 'CLIENT' },
    };
  }

  @OnEvent('negotiations.created')
  @OnEvent('negotiations.countered')
  @OnEvent('negotiations.accepted')
  @OnEvent('negotiations.rejected')
  @OnEvent('negotiations.cancelled')
  @OnEvent('negotiations.converted')
  async handleNegotiationChanged(
    event: NegotiationDomainEventEnvelope,
  ): Promise<void> {
    const negotiation = await this.negotiationsRepository.findById(
      event.payload.negotiationId,
    );
    const payload = {
      type: event.nom,
      negotiationId: event.payload.negotiationId,
      clientId: event.payload.clientId,
      professionalId: event.payload.professionalId,
      occurredAt: event.dateOccurrence,
      ...(negotiation ? { negotiation } : {}),
    };

    this.server
      .to(this.buildUserRoom(event.payload.clientId))
      .emit('negotiation.updated', payload);
    this.server
      .to(this.buildProfessionalRoom(event.payload.professionalId))
      .emit('negotiation.updated', payload);

    const professionalUserId = negotiation?.professionnel?.utilisateurId;
    if (professionalUserId) {
      this.server
        .to(this.buildUserRoom(professionalUserId))
        .emit('negotiation.updated', payload);
    }
  }

  private extractToken(client: Socket): string | null {
    const authToken =
      typeof client.handshake.auth?.token === 'string'
        ? client.handshake.auth.token
        : null;
    if (authToken) return authToken;

    const authorizationHeader = client.handshake.headers.authorization;
    if (
      typeof authorizationHeader === 'string' &&
      authorizationHeader.startsWith('Bearer ')
    ) {
      return authorizationHeader.slice(7);
    }

    return null;
  }

  private buildUserRoom(userId: string): string {
    return `user:${userId}`;
  }

  private buildProfessionalRoom(professionalId: string): string {
    return `negotiations:professional:${professionalId}`;
  }

  private getSocketUser(client: AuthenticatedSocket): AuthUser | null {
    return client.data.user ?? null;
  }

  private setSocketUser(client: AuthenticatedSocket, user: AuthUser): void {
    client.data.user = user;
  }
}
