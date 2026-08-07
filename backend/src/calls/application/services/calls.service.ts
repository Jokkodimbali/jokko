import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
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
  type CallView,
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
    await this.assertUserCanCall(user);
    const signal = await this.prepareSignal(user, conversationId, callId, kind);
    if (!(await this.callsRepository.isUserActive(signal.recipientId))) {
      throw new ConflictException("Le destinataire n'est pas disponible.");
    }
    const creation = await this.callsRepository.create({
      id: callId,
      conversationId,
      callerId: signal.callerId,
      recipientId: signal.recipientId,
      kind,
      // Aucun delai fonctionnel : l'appel reste en sonnerie jusqu'a une action
      // explicite de l'un des participants.
      expiresAt: new Date('9999-12-31T23:59:59.999Z'),
    });
    if (creation === 'BUSY') {
      throw new ConflictException('Un des participants est deja en appel.');
    }
    if (creation === 'IDEMPOTENT') return signal;
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
    const call = await this.requireCall(
      user,
      input.callId,
      input.conversationId,
    );
    if (call.kind !== input.kind) {
      throw new ForbiddenException("Le type de l'appel ne correspond pas.");
    }
    if (
      (status === 'ACCEPTED' || status === 'REJECTED') &&
      user.sub !== call.recipientId
    ) {
      throw new ForbiddenException(
        'Seul le destinataire peut repondre a cet appel.',
      );
    }
    const signal = this.toSignal(call);
    const from: CallStatus[] =
      status === 'ACCEPTED' || status === 'REJECTED'
        ? ['RINGING']
        : ['RINGING', 'ACCEPTED'];
    const changed = await this.callsRepository.transition({
      id: input.callId,
      actorId: user.sub,
      from,
      to: status,
    });
    if (!changed) {
      const current = await this.callsRepository.findForParticipant(
        input.callId,
        user.sub,
      );
      const idempotent =
        current?.status === status ||
        (status === 'ENDED' && current?.status === 'MISSED');
      if (!idempotent) {
        throw new ConflictException("L'etat de l'appel a deja change.");
      }
    }
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
    const callerIdentity = await this.callsRepository.findUserIdentity(
      user.sub,
    );
    return {
      callId,
      conversationId,
      kind,
      callerId: user.sub,
      recipientId,
      callerName: callerIdentity?.name || user.phoneNumber,
      callerAvatarUrl: callerIdentity?.avatarUrl ?? null,
      occurredAt: new Date().toISOString(),
    };
  }

  async createJoinCredential(
    user: AuthUser,
    conversationId: string,
    callId: string,
  ) {
    const call = await this.requireCall(user, callId, conversationId);
    if (call.status !== 'ACCEPTED') {
      throw new ForbiddenException("Cet appel n'est plus actif.");
    }
    return this.mediaRooms.createJoinCredential({
      roomName: `jokko-call-${callId}`,
      userId: user.sub,
      displayName: user.phoneNumber,
      kind: call.kind,
    });
  }

  async getActiveCall(user: AuthUser) {
    await this.assertUserCanCall(user);
    const call = await this.callsRepository.findActiveForUser(user.sub);
    if (!call) return null;
    const signal = this.toSignal(call);
    return {
      ...signal,
      status: call.status,
      counterpartName:
        call.callerId === user.sub ? call.recipientName : call.callerName,
      counterpartAvatarUrl:
        call.callerId === user.sub
          ? call.recipientAvatarUrl
          : call.callerAvatarUrl,
      direction:
        call.callerId === user.sub
          ? ('OUTGOING' as const)
          : ('INCOMING' as const),
    };
  }

  async endActiveCallForDisconnectedUser(
    userId: string,
  ): Promise<CallSignal | null> {
    const call = await this.callsRepository.findActiveForUser(userId);
    if (!call) return null;
    const changed = await this.callsRepository.transition({
      id: call.id,
      actorId: userId,
      from: ['RINGING', 'ACCEPTED'],
      to: 'ENDED',
    });
    return changed ? this.toSignal(call) : null;
  }

  private async requireCall(
    user: AuthUser,
    callId: string,
    conversationId: string,
  ) {
    await this.assertUserCanCall(user);
    const call = await this.callsRepository.findForParticipant(
      callId,
      user.sub,
    );
    if (!call) throw new NotFoundException('Appel introuvable.');
    if (call.conversationId !== conversationId) {
      throw new ForbiddenException(
        "Cet appel n'appartient pas a cette conversation.",
      );
    }
    return call;
  }

  async assertUserCanCall(user: AuthUser): Promise<void> {
    if (!(await this.callsRepository.isUserActive(user.sub))) {
      throw new ForbiddenException(
        'Ce compte ne peut pas utiliser les appels.',
      );
    }
  }

  private toSignal(call: CallView): CallSignal {
    return {
      callId: call.id,
      conversationId: call.conversationId,
      kind: call.kind,
      callerId: call.callerId,
      recipientId: call.recipientId,
      callerName: call.callerName,
      callerAvatarUrl: call.callerAvatarUrl,
      occurredAt: call.startedAt.toISOString(),
    } satisfies CallSignal;
  }
}
