import {
  Ack,
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
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
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
  private readonly userSockets = new Map<string, Set<string>>();

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly liveTrackingFacade: LiveTrackingFacade,
    private readonly realtimeEvents: EventEmitter2,
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
      const sockets = this.userSockets.get(user.sub) ?? new Set<string>();
      const isFirstConnection = sockets.size === 0;
      sockets.add(client.id);
      this.userSockets.set(user.sub, sockets);
      if (isFirstConnection) {
        await this.liveTrackingFacade.syncProfessionalConnection(user, true);
        this.realtimeEvents.emit('user.presence.updated', {
          userId: user.sub,
          isOnline: true,
          changedAt: new Date().toISOString(),
        });
      }
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

    const sockets = this.userSockets.get(user.sub);
    sockets?.delete(client.id);
    if (sockets?.size) {
      return;
    }
    this.userSockets.delete(user.sub);
    await this.liveTrackingFacade.syncProfessionalConnection(user, false);
    this.realtimeEvents.emit('user.presence.updated', {
      userId: user.sub,
      isOnline: false,
      changedAt: new Date().toISOString(),
    });
  }

  @SubscribeMessage('session.logout')
  handleSessionLogout(
    @ConnectedSocket() client: AuthenticatedSocket,
    @Ack() acknowledge: () => void,
  ): void {
    const user = this.getSocketUser(client);
    if (!user) return;

    this.realtimeEvents.emit('user.presence.updated', {
      userId: user.sub,
      isOnline: false,
      changedAt: new Date().toISOString(),
    });
    acknowledge();
    queueMicrotask(() => {
      this.server.in(this.buildUserRoom(user.sub)).disconnectSockets(true);
    });
  }

  @SubscribeMessage('tracking.subscribe')
  async handleSubscribe(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: { reservationId: string },
  ) {
    const user = this.getSocketUser(client);
    if (!user || !this.isValidIdentifier(payload?.reservationId)) {
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

  @SubscribeMessage('tracking.unsubscribe')
  async handleUnsubscribe(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: { reservationId: string },
  ) {
    if (!this.isValidIdentifier(payload?.reservationId)) {
      return {
        event: 'tracking.error',
        data: { code: 'TRACKING_RESERVATION_ID_INVALID' },
      };
    }
    await client.leave(this.buildReservationRoom(payload.reservationId));
    return {
      event: 'tracking.unsubscribed',
      data: { reservationId: payload.reservationId },
    };
  }

  @SubscribeMessage('professional.presence.subscribe')
  async handlePresenceSubscribe(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: { professionalId: string },
  ) {
    const user = this.getSocketUser(client);
    if (!user || !this.isValidIdentifier(payload?.professionalId)) {
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

  @SubscribeMessage('professional.availability.subscribe')
  async handleAvailabilitySubscribe(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: { professionalId: string },
  ) {
    const user = this.getSocketUser(client);
    if (!user || !this.isValidIdentifier(payload?.professionalId)) {
      client.disconnect();
      return;
    }

    await client.join(this.buildProfessionalRoom(payload.professionalId));

    return {
      event: 'professional.availability.subscribed',
      data: { professionalId: payload.professionalId },
    };
  }

  @SubscribeMessage('professional.availability.unsubscribe')
  async handleAvailabilityUnsubscribe(
    @ConnectedSocket() client: AuthenticatedSocket,
    @MessageBody() payload: { professionalId: string },
  ) {
    if (!this.isValidIdentifier(payload?.professionalId)) {
      return {
        event: 'professional.availability.error',
        data: { code: 'PROFESSIONAL_ID_INVALID' },
      };
    }

    await client.leave(this.buildProfessionalRoom(payload.professionalId));
    return {
      event: 'professional.availability.unsubscribed',
      data: { professionalId: payload.professionalId },
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
    if (!user || !this.isValidIdentifier(payload?.reservationId)) {
      client.disconnect();
      return;
    }

    const tracking = await this.liveTrackingFacade.updateLocation(
      user,
      payload.reservationId,
      payload,
    );

    return {
      reservationId: tracking.reservationId,
      accepted: true,
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

  @OnEvent('professional.availability.changed')
  handleProfessionalAvailabilityChanged(payload: {
    professionalId: string;
    changedAt: string;
    reason: 'availability' | 'service';
  }): void {
    this.server
      .to(this.buildProfessionalRoom(payload.professionalId))
      .emit('professional.availability.changed', payload);
  }

  @OnEvent('tracking.provider.assigned')
  @OnEvent('tracking.provider.started-trip')
  @OnEvent('tracking.provider.arrived')
  @OnEvent('tracking.service.started')
  @OnEvent('tracking.service.completed')
  async handleMissionStatusUpdated(event: {
    nom: string;
    payload: {
      reservationId: string;
      clientUserId: string;
      professionalId: string;
    };
    dateOccurrence: Date;
  }): Promise<void> {
    const tracking = await this.safeGetReservationTrackingSnapshot(event);
    const payload = {
      type: event.nom,
      occurredAt: event.dateOccurrence,
      ...(tracking ? { tracking } : {}),
      ...event.payload,
    };
    this.server
      .to(this.buildReservationRoom(event.payload.reservationId))
      .emit('tracking.mission.updated', payload);
    this.server
      .to(this.buildUserRoom(event.payload.clientUserId))
      .emit('tracking.mission.updated', payload);
    this.server
      .to(this.buildProfessionalRoom(event.payload.professionalId))
      .emit('tracking.mission.updated', payload);
  }

  private async safeGetReservationTrackingSnapshot(event: {
    payload: {
      reservationId: string;
      clientUserId: string;
    };
  }) {
    try {
      return await this.liveTrackingFacade.getReservationTracking(
        {
          sub: event.payload.clientUserId,
          role: 'CLIENT',
          phoneNumber: '',
        },
        event.payload.reservationId,
      );
    } catch {
      return null;
    }
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

  private isValidIdentifier(value: unknown): value is string {
    return typeof value === 'string' && value.trim().length > 0;
  }
}
