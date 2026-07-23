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
  PROFESSIONALS_REPOSITORY_PORT,
  type ProfessionalsRepositoryPort,
} from '../../../professionals/application/ports/professionals-repository.port';
import {
  RESERVATIONS_REPOSITORY_PORT,
  type ReservationsRepositoryPort,
} from '../../application/ports/reservations-repository.port';

type AuthenticatedSocket = Socket & {
  data: {
    user?: AuthUser;
  };
};

type ReservationDomainEventEnvelope = {
  nom: string;
  payload: {
    reservationId: string;
    clientId: string;
    professionalId: string;
  };
  dateOccurrence: Date;
};

@WebSocketGateway({
  namespace: '/socket',
  cors: buildSocketCorsOptionsFromProcessEnv(),
})
export class ReservationsGateway implements OnGatewayConnection {
  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    @Inject(RESERVATIONS_REPOSITORY_PORT)
    private readonly reservationsRepository: ReservationsRepositoryPort,
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

  @SubscribeMessage('reservations.subscribe')
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
      event: 'reservations.subscribed',
      data: { scope: payload?.scope ?? 'CLIENT' },
    };
  }

  @OnEvent('reservations.created')
  @OnEvent('reservations.updated')
  async handleReservationChanged(
    event: ReservationDomainEventEnvelope,
  ): Promise<void> {
    const reservation = await this.reservationsRepository.findDetailedById(
      event.payload.reservationId,
    );
    const payload = {
      type: event.nom,
      reservationId: event.payload.reservationId,
      clientId: event.payload.clientId,
      professionalId: event.payload.professionalId,
      occurredAt: event.dateOccurrence,
      ...(reservation ? { reservation } : {}),
    };

    this.server
      .to(this.buildUserRoom(event.payload.clientId))
      .emit('reservation.updated', payload);
    this.server
      .to(this.buildProfessionalRoom(event.payload.professionalId))
      .emit('reservation.updated', payload);

    const professionalUserId = reservation?.professionnel.utilisateurId;
    if (professionalUserId) {
      this.server
        .to(this.buildUserRoom(professionalUserId))
        .emit('reservation.updated', payload);
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
    return `reservations:professional:${professionalId}`;
  }

  private getSocketUser(client: AuthenticatedSocket): AuthUser | null {
    const socketData = client.data as { user?: AuthUser };
    return socketData.user ?? null;
  }

  private setSocketUser(client: AuthenticatedSocket, user: AuthUser): void {
    const socketData = client.data as { user?: AuthUser };
    socketData.user = user;
  }
}
