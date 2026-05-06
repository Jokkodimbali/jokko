import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { OnEvent } from '@nestjs/event-emitter';
import { Server, Socket } from 'socket.io';
import type { AuthUser } from '../../../auth/security/auth-user.type';
import { LiveTrackingFacade } from '../../application/services/live-tracking-facade.service';
import type { TrackingLocationDto } from '../dto/tracking-location.dto';
import { buildSocketCorsOptionsFromProcessEnv } from '../../../core/config/cors.config';

type AuthenticatedSocket = Socket & {
  data: {
    user?: AuthUser;
  };
};

@WebSocketGateway({
  namespace: '/socket',
  cors: buildSocketCorsOptionsFromProcessEnv(),
})
export class LiveTrackingGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server!: Server;

  private readonly socketUsers = new Map<string, AuthUser>();

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly liveTrackingFacade: LiveTrackingFacade,
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
      await this.liveTrackingFacade.syncProfessionalConnection(user, true);
    } catch {
      client.disconnect();
    }
  }

  async handleDisconnect(client: AuthenticatedSocket): Promise<void> {
    const user = this.getSocketUser(client);
    this.socketUsers.delete(client.id);
    if (!user) {
      return;
    }

    await this.liveTrackingFacade.syncProfessionalConnection(user, false);
  }

  @SubscribeMessage('tracking.subscribe')
  async handleSubscribe(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: { reservationId: string },
  ) {
    const user = this.getSocketUser(client);
    if (!user) {
      client.disconnect();
      return;
    }

    const tracking = await this.liveTrackingFacade.getReservationTracking(
      user,
      payload.reservationId,
    );
    await client.join(this.buildReservationRoom(payload.reservationId));

    return {
      event: 'tracking.snapshot',
      data: tracking,
    };
  }

  @SubscribeMessage('professional.presence.subscribe')
  async handlePresenceSubscribe(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: { professionalId: string },
  ) {
    const user = this.getSocketUser(client);
    if (!user) {
      client.disconnect();
      return;
    }

    const presence = await this.liveTrackingFacade.getProfessionalPresence(
      payload.professionalId,
    );
    await client.join(this.buildProfessionalRoom(payload.professionalId));

    return {
      event: 'professional.presence.snapshot',
      data: presence,
    };
  }

  @SubscribeMessage('tracking.location.update')
  async handleLocationUpdate(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody()
    payload: TrackingLocationDto & {
      reservationId: string;
    },
  ) {
    const user = this.getSocketUser(client);
    if (!user) {
      client.disconnect();
      return;
    }

    const tracking = await this.liveTrackingFacade.updateLocation(
      user,
      payload.reservationId,
      payload,
    );

    this.publishTrackingUpdate(tracking);
    return {
      event: 'tracking.location.updated',
      data: tracking,
    };
  }

  @OnEvent('live-tracking.location.updated')
  handleTrackingRealtimeUpdate(payload: {
    reservationId: string;
    clientUserId: string;
    presence: { professionalId: string };
  }): void {
    this.server
      .to(this.buildReservationRoom(payload.reservationId))
      .emit('tracking.location.updated', payload);
    this.server
      .to(this.buildUserRoom(payload.clientUserId))
      .emit('tracking.location.updated', payload);
    this.server
      .to(this.buildProfessionalRoom(payload.presence.professionalId))
      .emit('professional.presence.updated', payload.presence);
  }

  @OnEvent('live-tracking.presence.updated')
  handlePresenceRealtimeUpdate(payload: { professionalId: string }): void {
    this.server
      .to(this.buildProfessionalRoom(payload.professionalId))
      .emit('professional.presence.updated', payload);
  }

  private publishTrackingUpdate(payload: {
    reservationId: string;
    clientUserId: string;
    presence: { professionalId: string };
  }): void {
    this.server
      .to(this.buildReservationRoom(payload.reservationId))
      .emit('tracking.location.updated', payload);
    this.server
      .to(this.buildUserRoom(payload.clientUserId))
      .emit('tracking.location.updated', payload);
    this.server
      .to(this.buildProfessionalRoom(payload.presence.professionalId))
      .emit('professional.presence.updated', payload.presence);
  }

  private extractToken(client: Socket): string | null {
    const authToken =
      typeof client.handshake.auth?.token === 'string'
        ? client.handshake.auth.token
        : null;
    if (authToken) {
      return authToken;
    }

    const authorizationHeader = client.handshake.headers.authorization;
    if (
      typeof authorizationHeader === 'string' &&
      authorizationHeader.startsWith('Bearer ')
    ) {
      return authorizationHeader.slice(7);
    }

    return null;
  }

  private buildReservationRoom(reservationId: string): string {
    return `tracking:reservation:${reservationId}`;
  }

  private buildProfessionalRoom(professionalId: string): string {
    return `tracking:professional:${professionalId}`;
  }

  private buildUserRoom(userId: string): string {
    return `user:${userId}`;
  }

  private getSocketUser(client: AuthenticatedSocket): AuthUser | null {
    return this.socketUsers.get(client.id) ?? null;
  }

  private setSocketUser(client: AuthenticatedSocket, user: AuthUser): void {
    this.socketUsers.set(client.id, user);
  }
}
