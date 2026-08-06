import { Inject, Injectable } from '@nestjs/common';
import type { AuthUser } from '../../../auth/security/auth-user.type';
import { MessagingFacade } from '../../../messaging/application/services/messaging-facade.service';
import type { CallKind, CallSignal } from '../../domain/call.types';
import {
  MEDIA_ROOM_PROVIDER_PORT,
  type MediaRoomProviderPort,
} from '../ports/media-room-provider.port';
import {
  CALLS_REPOSITORY_PORT,
  type CallsRepositoryPort,
  type CallStatus,
} from '../ports/calls-repository.port';
import { NotificationsService } from '../../../notifications/application/services/notifications.service';

@Injectable()
export class CallsService {
  constructor(
    private readonly messaging: MessagingFacade,
    @Inject(MEDIA_ROOM_PROVIDER_PORT)
    private readonly mediaRooms: MediaRoomProviderPort,
    @Inject(CALLS_REPOSITORY_PORT)
    private readonly callsRepository: CallsRepositoryPort,
    private readonly notifications: NotificationsService,
  ) {}

  async initiate(
    user: AuthUser,
    conversationId: string,
    callId: string,
    kind: CallKind,
  ): Promise<CallSignal> {
    const signal = await this.prepareSignal(user, conversationId, callId, kind);
    await this.callsRepository.create({
      id: callId,
      conversationId,
      callerId: signal.callerId,
      recipientId: signal.recipientId,
      kind,
      // Aucun delai fonctionnel : l'appel reste en sonnerie jusqu'a une action
      // explicite de l'un des participants.
      expiresAt: new Date('9999-12-31T23:59:59.999Z'),
    });
    await this.notifications.createInAppNotification({
      userId: signal.recipientId,
      type: 'APPEL_ENTRANT',
      title: kind === 'VIDEO' ? 'Appel vidéo entrant' : 'Appel vocal entrant',
      body: `${signal.callerName} vous appelle.`,
      data: { callId, conversationId, kind, route: '/messages' },
    });
    return signal;
  }

  async transition(
    user: AuthUser,
    input: { callId: string; conversationId: string; kind: CallKind },
    status: CallStatus,
  ): Promise<CallSignal> {
    const signal = await this.prepareSignal(
      user,
      input.conversationId,
      input.callId,
      input.kind,
    );
    const from: CallStatus[] =
      status === 'ACCEPTED' || status === 'REJECTED'
        ? ['RINGING']
        : ['RINGING', 'ACCEPTED'];
    await this.callsRepository.transition({
      id: input.callId,
      actorId: user.sub,
      from,
      to: status,
    });
    return signal;
  }

  listHistory(user: AuthUser, limit = 50, offset = 0) {
    return this.callsRepository.listForUser(
      user.sub,
      Math.min(Math.max(limit, 1), 100),
      Math.max(offset, 0),
    );
  }

  async prepareSignal(
    user: AuthUser,
    conversationId: string,
    callId: string,
    kind: CallKind,
  ): Promise<CallSignal> {
    const conversation = await this.messaging.getConversationForUser(
      user,
      conversationId,
    );
    const recipientId =
      conversation.clientUserId === user.sub
        ? conversation.professionalUserId
        : conversation.clientUserId;
    return {
      callId,
      conversationId,
      kind,
      callerId: user.sub,
      recipientId,
      callerName: user.phoneNumber,
      callerAvatarUrl: null,
      occurredAt: new Date().toISOString(),
    };
  }

  async createJoinCredential(
    user: AuthUser,
    conversationId: string,
    callId: string,
    kind: CallKind,
  ) {
    await this.messaging.getConversationForUser(user, conversationId);
    return this.mediaRooms.createJoinCredential({
      roomName: `jokko-call-${callId}`,
      userId: user.sub,
      displayName: user.phoneNumber,
      kind,
    });
  }
}
