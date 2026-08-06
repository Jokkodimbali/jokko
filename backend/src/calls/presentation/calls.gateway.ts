import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Server, Socket } from 'socket.io';
import type { AuthUser } from '../../auth/security/auth-user.type';
import { buildSocketCorsOptionsFromProcessEnv } from '../../core/config/cors.config';
import { CallsService } from '../application/services/calls.service';
import type { CallKind, CallSignal } from '../domain/call.types';
import { OnEvent } from '@nestjs/event-emitter';

type CallSocket = Socket;
type CallSocketData = { user?: AuthUser };
type SignalInput = { callId: string; conversationId: string; kind: CallKind };

@WebSocketGateway({
  namespace: '/calls',
  cors: buildSocketCorsOptionsFromProcessEnv(),
})
export class CallsGateway implements OnGatewayConnection {
  @WebSocketServer() server!: Server;
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly calls: CallsService,
  ) {}

  async handleConnection(client: CallSocket): Promise<void> {
    const token =
      typeof client.handshake.auth?.token === 'string'
        ? client.handshake.auth.token
        : null;
    if (!token) {
      client.disconnect();
      return;
    }
    try {
      const user = await this.jwt.verifyAsync<AuthUser>(token, {
        secret: this.config.get<string>('JWT_ACCESS_SECRET'),
      });
      (client.data as CallSocketData).user = user;
      await client.join(`user:${user.sub}`);
    } catch {
      client.disconnect();
    }
  }

  @SubscribeMessage('call.initiate')
  async initiate(
    @ConnectedSocket() client: CallSocket,
    @MessageBody() input: SignalInput,
  ) {
    const user = this.requireUser(client);
    const signal = await this.calls.initiate(
      user,
      input.conversationId,
      input.callId,
      input.kind,
    );
    this.server.to(`user:${signal.recipientId}`).emit('call.incoming', signal);
    return { event: 'call.initiated', data: signal };
  }

  @SubscribeMessage('call.accept') accept(
    @ConnectedSocket() client: CallSocket,
    @MessageBody() input: SignalInput,
  ) {
    return this.forward(client, input, 'call.accepted', 'ACCEPTED');
  }
  @SubscribeMessage('call.reject') reject(
    @ConnectedSocket() client: CallSocket,
    @MessageBody() input: SignalInput,
  ) {
    return this.forward(client, input, 'call.rejected', 'REJECTED');
  }
  @SubscribeMessage('call.end') end(
    @ConnectedSocket() client: CallSocket,
    @MessageBody() input: SignalInput,
  ) {
    return this.forward(client, input, 'call.ended', 'ENDED');
  }

  @OnEvent('calls.missed')
  missed(signal: CallSignal): void {
    this.server
      .to([`user:${signal.callerId}`, `user:${signal.recipientId}`])
      .emit('call.missed', signal);
  }

  private async forward(
    client: CallSocket,
    input: SignalInput,
    event: string,
    status: 'ACCEPTED' | 'REJECTED' | 'ENDED',
  ) {
    const signal = await this.calls.transition(
      this.requireUser(client),
      input,
      status,
    );
    this.server.to(`user:${signal.recipientId}`).emit(event, signal);
    return { event, data: signal };
  }

  private requireUser(client: CallSocket): AuthUser {
    const user = (client.data as CallSocketData).user;
    if (!user) {
      client.disconnect();
      throw new Error('Unauthenticated socket');
    }
    return user;
  }
}
