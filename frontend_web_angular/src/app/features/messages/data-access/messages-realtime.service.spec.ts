import { TestBed } from '@angular/core/testing';
import { PLATFORM_ID } from '@angular/core';
import { afterEach, expect, it, vi } from 'vitest';
import { AuthSessionService } from '../../../core/auth/auth-session.service';
import { MessagesRealtimeService } from './messages-realtime.service';

const socket = vi.hoisted(() => ({
  on: vi.fn(),
  io: { on: vi.fn() },
  emit: vi.fn(),
  disconnect: vi.fn(),
}));
vi.mock('socket.io-client', () => ({ io: () => socket }));
afterEach(() => {
  TestBed.resetTestingModule();
  vi.clearAllMocks();
});

it('forwards targeted mediation events into the discussion message stream', () => {
  TestBed.configureTestingModule({
    providers: [
      { provide: PLATFORM_ID, useValue: 'browser' },
      { provide: AuthSessionService, useValue: { getAccessToken: () => 'test-token' } },
    ],
  });
  const service = TestBed.inject(MessagesRealtimeService);
  const received = vi.fn();
  const subscription = service.messageCreated$.subscribe(received);
  service.connect();
  const listener = socket.on.mock.calls.find(
    ([event]) => event === 'dispute.mediation.message.created',
  )![1];
  listener({
    id: 'private-message',
    conversationId: 'conversation',
    authorId: 'admin',
    authorName: 'Moderation',
    recipient: 'CLIENT',
    content: 'Votre justificatif',
    createdAt: '2026-09-15T12:00:00Z',
  });
  expect(received).toHaveBeenCalledExactlyOnceWith({
    id: 'private-message',
    conversationId: 'conversation',
    senderId: 'admin',
    content: 'Votre justificatif',
    mediaUrl: null,
    isRead: false,
    createdAt: '2026-09-15T12:00:00.000Z',
    sender: { id: 'admin', name: 'Moderation', avatarUrl: null },
  });
  subscription.unsubscribe();
  service.disconnect();
});
