import { ConflictException, ForbiddenException } from '@nestjs/common';
import type { AuthUser } from '../../../auth/security/auth-user.type';
import { CallsService } from './calls.service';

describe('CallsService security and idempotency', () => {
  const user = {
    sub: '11111111-1111-4111-8111-111111111111',
    role: 'CLIENT',
    phoneNumber: '+221770000000',
  } as AuthUser;
  const call = {
    id: '22222222-2222-4222-8222-222222222222',
    conversationId: '33333333-3333-4333-8333-333333333333',
    kind: 'VIDEO' as const,
    status: 'RINGING' as const,
    callerId: user.sub,
    recipientId: '44444444-4444-4444-8444-444444444444',
    callerName: 'Client',
    callerAvatarUrl: null,
    recipientName: 'Prestataire',
    recipientAvatarUrl: null,
    startedAt: new Date(),
  };
  const messaging = { getConversationForUser: jest.fn() };
  const mediaRooms = { createJoinCredential: jest.fn() };
  const repository = {
    isUserActive: jest.fn(),
    findUserIdentity: jest.fn(),
    create: jest.fn(),
    transition: jest.fn(),
    listForUser: jest.fn(),
    expireRinging: jest.fn(),
    findForParticipant: jest.fn(),
    findActiveForUser: jest.fn(),
  };
  const notifications = { createInAppNotification: jest.fn() };
  const service = new CallsService(
    messaging as never,
    mediaRooms as never,
    repository as never,
    notifications as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    repository.isUserActive.mockResolvedValue(true);
    repository.findUserIdentity.mockResolvedValue({
      name: 'Client',
      avatarUrl: null,
    });
    repository.findForParticipant.mockResolvedValue(call);
    mediaRooms.createJoinCredential.mockResolvedValue({
      serverUrl: 'wss://livekit',
      token: 'jwt',
    });
  });

  it('uses the persisted call kind when issuing a room credential', async () => {
    repository.findForParticipant.mockResolvedValue({
      ...call,
      status: 'ACCEPTED',
    });
    await service.createJoinCredential(user, call.conversationId, call.id);

    expect(mediaRooms.createJoinCredential).toHaveBeenCalledWith(
      expect.objectContaining({
        roomName: `jokko-call-${call.id}`,
        kind: 'VIDEO',
      }),
    );
  });

  it('does not create an in-app notification for an incoming voice call', async () => {
    messaging.getConversationForUser.mockResolvedValue({
      clientUserId: user.sub,
      professionalUserId: call.recipientId,
    });
    repository.create.mockResolvedValue('CREATED');

    await service.initiate(user, call.conversationId, call.id, 'VOICE');

    expect(notifications.createInAppNotification).not.toHaveBeenCalled();
  });

  it('keeps the incoming notification for a video call', async () => {
    messaging.getConversationForUser.mockResolvedValue({
      clientUserId: user.sub,
      professionalUserId: call.recipientId,
    });
    repository.create.mockResolvedValue('CREATED');

    await service.initiate(user, call.conversationId, call.id, 'VIDEO');

    expect(notifications.createInAppNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'APPEL_ENTRANT',
        data: expect.objectContaining({ kind: 'VIDEO' }),
      }),
    );
  });

  it('rejects a call that belongs to another conversation', async () => {
    repository.findForParticipant.mockResolvedValue({
      ...call,
      status: 'ACCEPTED',
    });
    await expect(
      service.createJoinCredential(
        user,
        '55555555-5555-4555-8555-555555555555',
        call.id,
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects a non-idempotent concurrent state transition', async () => {
    const recipient = { ...user, sub: call.recipientId };
    repository.transition.mockResolvedValue(false);
    repository.findForParticipant
      .mockResolvedValueOnce(call)
      .mockResolvedValueOnce({ ...call, status: 'REJECTED' });

    await expect(
      service.transition(
        recipient,
        { callId: call.id, conversationId: call.conversationId, kind: 'VIDEO' },
        'ACCEPTED',
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('refuses disabled users even with a valid JWT payload', async () => {
    repository.isUserActive.mockResolvedValue(false);

    await expect(
      service.createJoinCredential(user, call.conversationId, call.id),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('terminates the active call after the disconnected-user grace period', async () => {
    repository.findActiveForUser.mockResolvedValue({
      ...call,
      status: 'ACCEPTED',
    });
    repository.transition.mockResolvedValue(true);

    const signal = await service.endActiveCallForDisconnectedUser(user.sub);

    expect(repository.transition).toHaveBeenCalledWith({
      id: call.id,
      actorId: user.sub,
      from: ['RINGING', 'ACCEPTED'],
      to: 'ENDED',
    });
    expect(signal).toEqual(
      expect.objectContaining({ callId: call.id, kind: 'VIDEO' }),
    );
  });

  it('does nothing when a disconnected user has no active call', async () => {
    repository.findActiveForUser.mockResolvedValue(null);

    await expect(
      service.endActiveCallForDisconnectedUser(user.sub),
    ).resolves.toBeNull();
    expect(repository.transition).not.toHaveBeenCalled();
  });
});
