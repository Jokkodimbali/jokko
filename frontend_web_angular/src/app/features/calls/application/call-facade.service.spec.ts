import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { Subject, of } from 'rxjs';
import { afterEach, expect, it, vi } from 'vitest';
import { CallFacade } from './call-facade.service';
import { AuthSessionService } from '../../../core/auth/auth-session.service';
import { AppFeedbackService } from '../../../core/feedback/app-feedback.service';
import { TabSessionStorageService } from '../../../core/storage/tab-session-storage.service';
import { CallsApiService } from '../data-access/calls-api.service';
import { CallsRealtimeService } from '../data-access/calls-realtime.service';
import { CallAudioService } from '../infrastructure/call-audio.service';

function setup() {
  const ending = new Subject<void>();
  const events = new Subject<any>();
  const currentUser = signal<any>({ id: 'user' });
  const realtime = {
    events$: events,
    connectionVersion: signal(0),
    connect: vi.fn(),
    disconnect: vi.fn(),
    emit: vi.fn().mockResolvedValue({}),
  };
  const audio = { stop: vi.fn(), playIncoming: vi.fn() };
  const api = { getActiveCall: vi.fn().mockReturnValue(of(null)), createJoinCredential: vi.fn() };
  TestBed.configureTestingModule({
    providers: [
      {
        provide: AuthSessionService,
        useValue: { sessionEnding$: ending, currentUser, authVersion: signal(0) },
      },
      { provide: CallsRealtimeService, useValue: realtime },
      { provide: CallsApiService, useValue: api },
      { provide: CallAudioService, useValue: audio },
      { provide: AppFeedbackService, useValue: { error: vi.fn() } },
      {
        provide: TabSessionStorageService,
        useValue: { remove: vi.fn(), get: vi.fn(), set: vi.fn() },
      },
    ],
  });
  const facade = TestBed.inject(CallFacade);
  TestBed.tick();
  return { facade, ending, events, currentUser, realtime, audio, api };
}
const call = { callId: 'call', conversationId: 'conversation', kind: 'AUDIO', phase: 'ACTIVE' };
afterEach(() => {
  TestBed.resetTestingModule();
  vi.restoreAllMocks();
});

it('stops media immediately on logout even when room disconnection is pending', async () => {
  const { facade, ending, realtime, audio } = setup();
  const track = { stop: vi.fn() };
  const element = { remove: vi.fn() };
  let finish!: () => void;
  const room = {
    removeAllListeners: vi.fn(),
    localParticipant: { trackPublications: new Map([['audio', { track }]]) },
    remoteParticipants: new Map([
      ['peer', { trackPublications: new Map([['audio', { track: { detach: () => [element] } }]]) }],
    ]),
    disconnect: vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    ),
  };
  (facade as any).callState.set(call);
  (facade as any).room = room;
  ending.next();
  expect(track.stop).toHaveBeenCalledOnce();
  expect(element.remove).toHaveBeenCalledOnce();
  expect(audio.stop).toHaveBeenCalled();
  expect(room.disconnect).toHaveBeenCalledWith(true);
  expect(facade.call()).toBeNull();
  expect(realtime.emit).toHaveBeenCalledWith('call.end', call);
  finish();
  await Promise.resolve();
});

it('clears a ringing call when the authenticated session disappears', () => {
  const { facade, events, currentUser, audio } = setup();
  events.next({ type: 'call.incoming', signal: call });
  expect(facade.call()).not.toBeNull();
  currentUser.set(null);
  TestBed.tick();
  expect(facade.call()).toBeNull();
  expect(audio.stop).toHaveBeenCalled();
  events.next({ type: 'call.incoming', signal: call });
  expect(facade.call()).toBeNull();
});

it('ignores join credentials arriving after logout', async () => {
  const { facade, api, ending } = setup();
  const credential = new Subject<any>();
  api.createJoinCredential.mockReturnValue(credential);
  (facade as any).callState.set(call);
  const pending = (facade as any).connectToRoom(call);
  ending.next();
  credential.next({ serverUrl: 'wss://unused.invalid', token: 'unused' });
  await pending;
  expect((facade as any).room).toBeNull();
  expect(facade.call()).toBeNull();
});
