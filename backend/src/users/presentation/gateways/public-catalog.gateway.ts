import { OnEvent } from '@nestjs/event-emitter';
import { OnGatewayConnection, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { buildSocketCorsOptionsFromProcessEnv } from '../../../core/config/cors.config';

export interface CatalogAccountStatusChangedEvent {
  userId: string;
  professionalId: string | null;
  active: boolean;
  changedAt: string;
}

export interface CatalogPresenceChangedEvent {
  userId?: string;
  professionalId: string;
  isOnline: boolean;
  status: string;
  lastSeenAt: Date | string | null;
}

@WebSocketGateway({
  namespace: '/public-catalog',
  cors: buildSocketCorsOptionsFromProcessEnv(),
})
export class PublicCatalogGateway implements OnGatewayConnection {
  @WebSocketServer()
  server!: Server;
  private readonly presences = new Map<string, {
    userId?: string;
    professionalId?: string;
    isOnline: boolean;
  }>();

  handleConnection(client: Socket): void {
    client.emit('catalog.presence.snapshot', [...this.presences.values()]);
  }

  @OnEvent('catalog.account-status.changed')
  handleAccountStatusChanged(payload: CatalogAccountStatusChangedEvent): void {
    this.server.emit('catalog.account-status.changed', payload);
  }

  @OnEvent('catalog.profile.changed')
  handleProfileChanged(payload: {
    userId: string;
    professionalId: string;
    address: string | null;
    latitude: number | null;
    longitude: number | null;
    changedAt: string;
  }): void {
    this.server.emit('catalog.profile.changed', payload);
  }

  @OnEvent('live-tracking.presence.updated')
  handlePresenceChanged(payload: CatalogPresenceChangedEvent): void {
    this.presences.set(`professional:${payload.professionalId}`, payload);
    this.server.emit('catalog.presence.changed', payload);
  }

  @OnEvent('user.presence.updated')
  handleUserPresenceChanged(payload: {
    userId: string;
    professionalId?: string;
    isOnline: boolean;
    changedAt: string;
  }): void {
    this.presences.set(`user:${payload.userId}`, payload);
    if (payload.professionalId) {
      this.presences.set(`professional:${payload.professionalId}`, payload);
    }
    this.server.emit('catalog.presence.changed', payload);
  }
}
