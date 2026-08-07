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
import { Logger, UsePipes, ValidationPipe } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Server, Socket } from 'socket.io';
import type { AuthUser } from '../../auth/security/auth-user.type';
import { buildSocketCorsOptionsFromProcessEnv } from '../../core/config/cors.config';
import { CallsService } from '../application/services/calls.service';
import type { CallSignal } from '../domain/call.types';
import { OnEvent } from '@nestjs/event-emitter';
import { CallSignalDto } from './call-signal.dto';

type CallSocket = Socket;
type CallSocketData = { user?: AuthUser };
@WebSocketGateway({
  namespace: '/calls',
  cors: buildSocketCorsOptionsFromProcessEnv(),
})
@UsePipes(
  new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  }),
)
export class CallsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private static readonly DISCONNECT_GRACE_MS = 70_000;
  private readonly logger = new Logger(CallsGateway.name);
  private readonly disconnectTimers = new Map<
    string,
    ReturnType<typeof setTimeout>
  >();
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
      await this.calls.assertUserCanCall(user);
      this.cancelDisconnectCleanup(user.sub);
      await client.join(`user:${user.sub}`);
    } catch {
      client.disconnect();
    }
  }

  handleDisconnect(client: CallSocket): void {
    const user = (client.data as CallSocketData).user;
    if (!user) return;
    this.scheduleDisconnectCleanup(user.sub);
  }

  @SubscribeMessage('call.initiate')
  async initiate(
    @ConnectedSocket() client: CallSocket,
    @MessageBody() input: CallSignalDto,
  ) {
    const user = this.requireUser(client);
    let signal: CallSignal;
    try {
      signal = await this.calls.initiate(
        user,
        input.conversationId,
        input.callId,
        input.kind,
      );
    } catch (error) {
      this.logger.error(
        `call.initiate failed for user ${user.sub}`,
        error instanceof Error ? error.stack : String(error),
      );
      throw error;
    }
    this.server.to(`user:${signal.recipientId}`).emit('call.incoming', signal);
    return { ok: true, data: signal };
  }

  @SubscribeMessage('call.accept') accept(
    @ConnectedSocket() client: CallSocket,
    @MessageBody() input: CallSignalDto,
  ) {
    return this.forward(client, input, 'call.accepted', 'ACCEPTED');
  }
  @SubscribeMessage('call.reject') reject(
    @ConnectedSocket() client: CallSocket,
    @MessageBody() input: CallSignalDto,
  ) {
    return this.forward(client, input, 'call.rejected', 'REJECTED');
  }
  @SubscribeMessage('call.end') end(
    @ConnectedSocket() client: CallSocket,
    @MessageBody() input: CallSignalDto,
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
    input: CallSignalDto,
    event: string,
    status: 'ACCEPTED' | 'REJECTED' | 'ENDED',
  ) {
    const signal = await this.calls.transition(
      this.requireUser(client),
      input,
      status,
    );
    if (status === 'ACCEPTED') {
      this.server.to(`user:${signal.callerId}`).emit(event, signal);
      client
        .to(`user:${this.requireUser(client).sub}`)
        .emit('call.answered-elsewhere', signal);
      return { ok: true, data: signal };
    }
    this.server
      .to([`user:${signal.callerId}`, `user:${signal.recipientId}`])
      .emit(event, signal);
    return { ok: true, data: signal };
  }

  private requireUser(client: CallSocket): AuthUser {
    const user = (client.data as CallSocketData).user;
    if (!user) {
      client.disconnect();
      throw new Error('Unauthenticated socket');
    }
    return user;
  }

  private scheduleDisconnectCleanup(userId: string): void {
    this.cancelDisconnectCleanup(userId);
    const timer = setTimeout(() => {
      this.disconnectTimers.delete(userId);
      void this.finishCallIfUserStayedDisconnected(userId);
    }, CallsGateway.DISCONNECT_GRACE_MS);
    timer.unref?.();
    this.disconnectTimers.set(userId, timer);
  }

  private cancelDisconnectCleanup(userId: string): void {
    const timer = this.disconnectTimers.get(userId);
    if (timer) clearTimeout(timer);
    this.disconnectTimers.delete(userId);
  }

  private async finishCallIfUserStayedDisconnected(
    userId: string,
  ): Promise<void> {
    try {
      const sockets = await this.server.in(`user:${userId}`).fetchSockets();
      if (sockets.length > 0) return;
      const signal = await this.calls.endActiveCallForDisconnectedUser(userId);
      if (!signal) return;
      this.server
        .to([`user:${signal.callerId}`, `user:${signal.recipientId}`])
        .emit('call.ended', signal);
    } catch (error) {
      this.logger.error(
        `Failed to clean up disconnected call for user ${userId}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }
}
