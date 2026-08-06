import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import {
  Room,
  RoomEvent,
  Track,
  createLocalAudioTrack,
  createLocalVideoTrack,
  type LocalVideoTrack,
  type RemoteTrack,
} from 'livekit-client';
import { CallsApiService } from '../data-access/calls-api.service';
import { CallsRealtimeService } from '../data-access/calls-realtime.service';
import type { ActiveCall, CallKind, CallSignal } from '../domain/call.models';
import { AuthSessionService } from '../../../core/auth/auth-session.service';
import { AppFeedbackService } from '../../../core/feedback/app-feedback.service';
import { getHttpErrorMessage } from '../../../core/http/api-response.utils';
import { CallAudioService } from '../infrastructure/call-audio.service';

@Injectable({ providedIn: 'root' })
export class CallFacade {
  private readonly api = inject(CallsApiService);
  private readonly realtime = inject(CallsRealtimeService);
  private readonly auth = inject(AuthSessionService);
  private readonly feedback = inject(AppFeedbackService);
  private readonly callAudio = inject(CallAudioService);
  private readonly callState = signal<ActiveCall | null>(null);
  private readonly remoteTrackState = signal<RemoteTrack[]>([]);
  private readonly localVideoTrackState = signal<LocalVideoTrack | null>(null);
  private readonly durationSecondsState = signal(0);
  private room: Room | null = null;
  private joinPromise: Promise<void> | null = null;
  private durationTimer: ReturnType<typeof setInterval> | null = null;
  readonly call = this.callState.asReadonly();
  readonly remoteTrack = this.remoteTrackState.asReadonly();
  readonly localVideoTrack = this.localVideoTrackState.asReadonly();
  readonly durationSeconds = this.durationSecondsState.asReadonly();
  readonly isMuted = signal(false);
  readonly isCameraEnabled = signal(true);
  readonly isSpeakerEnabled = signal(true);
  readonly isOverlayVisible = signal(true);
  readonly audioInputDevices = signal<MediaDeviceInfo[]>([]);
  readonly videoInputDevices = signal<MediaDeviceInfo[]>([]);
  readonly selectedAudioInputId = signal<string | null>(null);
  readonly selectedVideoInputId = signal<string | null>(null);
  readonly historyVersion = signal(0);
  readonly isBusy = computed(() => this.callState() !== null);

  constructor() {
    effect(() => {
      if (this.auth.currentUser()) this.realtime.connect();
      else this.realtime.disconnect();
    });
    this.realtime.events$.subscribe(({ type, signal }) => {
      if (type === 'call.incoming' && !this.callState()) {
        this.callState.set({
          ...signal,
          phase: 'INCOMING',
          counterpartName: signal.callerName,
          counterpartAvatarUrl: signal.callerAvatarUrl,
        });
        this.callAudio.playIncoming();
      } else if (type === 'call.accepted' && this.matches(signal)) {
        this.callAudio.stop();
        void this.joinRoom();
      } else if (
        (type === 'call.rejected' || type === 'call.ended' || type === 'call.missed') &&
        this.matches(signal)
      ) {
        void this.clear();
      }
    });
  }

  start(
    conversationId: string,
    kind: CallKind,
    counterpartName: string,
    counterpartAvatarUrl: string | null,
  ): void {
    if (this.isBusy()) return;
    const signal: CallSignal = {
      callId: crypto.randomUUID(),
      conversationId,
      kind,
      callerId: '',
      recipientId: '',
      callerName: '',
      callerAvatarUrl: null,
      occurredAt: new Date().toISOString(),
    };
    this.callState.set({ ...signal, phase: 'OUTGOING', counterpartName, counterpartAvatarUrl });
    this.isOverlayVisible.set(true);
    this.callAudio.playOutgoing();
    this.realtime.emit('call.initiate', signal);
  }

  async accept(): Promise<void> {
    const call = this.callState();
    if (!call) return;
    this.callAudio.stop();
    this.realtime.emit('call.accept', call);
    await this.joinRoom();
  }

  minimizeOverlay(): void {
    this.isOverlayVisible.set(false);
  }
  showOverlay(): void {
    if (this.callState()) this.isOverlayVisible.set(true);
  }

  reject(): void {
    const call = this.callState();
    if (call) this.realtime.emit('call.reject', call);
    void this.clear();
  }
  end(): void {
    const call = this.callState();
    if (call) this.realtime.emit('call.end', call);
    void this.clear();
  }

  async toggleMute(): Promise<void> {
    const next = !this.isMuted();
    await this.room?.localParticipant.setMicrophoneEnabled(!next);
    this.isMuted.set(next);
  }

  async toggleCamera(): Promise<void> {
    if (this.callState()?.kind !== 'VIDEO') return;
    const next = !this.isCameraEnabled();
    await this.room?.localParticipant.setCameraEnabled(next);
    this.isCameraEnabled.set(next);
  }

  toggleSpeaker(): void {
    this.isSpeakerEnabled.update((enabled) => !enabled);
  }

  async selectAudioInput(deviceId: string): Promise<void> {
    if (!this.room) return;
    await this.room.switchActiveDevice('audioinput', deviceId);
    this.selectedAudioInputId.set(deviceId);
  }

  async selectVideoInput(deviceId: string): Promise<void> {
    if (!this.room || this.callState()?.kind !== 'VIDEO') return;
    await this.room.switchActiveDevice('videoinput', deviceId);
    this.selectedVideoInputId.set(deviceId);
  }

  private async joinRoom(): Promise<void> {
    const call = this.callState();
    if (!call || call.phase === 'ACTIVE' || call.phase === 'CONNECTING') return;
    if (this.joinPromise) return this.joinPromise;
    this.callState.update((value) => (value ? { ...value, phase: 'CONNECTING' } : null));
    this.joinPromise = this.connectToRoom(call);
    try {
      await this.joinPromise;
    } catch (error: unknown) {
      this.feedback.error(this.callConnectionErrorMessage(error, call.kind));
      this.realtime.emit('call.end', call);
      await this.clear();
    } finally {
      this.joinPromise = null;
    }
  }

  private async connectToRoom(call: ActiveCall): Promise<void> {
    const credential = await firstValueFrom(
      this.api.createJoinCredential(call.conversationId, call.callId, call.kind),
    );
    const room = new Room();
    room.on(RoomEvent.TrackSubscribed, (track) => {
      if (track.kind === Track.Kind.Audio || track.kind === Track.Kind.Video) {
        this.remoteTrackState.update((tracks) => [
          ...tracks.filter((item) => item.sid !== track.sid),
          track,
        ]);
      }
    });
    room.on(RoomEvent.TrackUnsubscribed, (track) => {
      track.detach().forEach((element) => element.remove());
      this.remoteTrackState.update((tracks) => tracks.filter((item) => item.sid !== track.sid));
    });
    room.on(RoomEvent.Disconnected, () => void this.clear());
    await room.connect(credential.serverUrl, credential.token);
    const microphoneTrack = await createLocalAudioTrack();
    await room.localParticipant.publishTrack(microphoneTrack);
    if (call.kind === 'VIDEO') {
      const cameraTrack = await createLocalVideoTrack();
      await room.localParticipant.publishTrack(cameraTrack);
      this.localVideoTrackState.set(cameraTrack);
    }
    this.room = room;
    await this.refreshMediaDevices();
    this.callState.update((value) => (value ? { ...value, phase: 'ACTIVE' } : null));
    this.startDurationTimer();
  }

  private matches(signal: CallSignal): boolean {
    return this.callState()?.callId === signal.callId;
  }

  private callConnectionErrorMessage(error: unknown, kind: CallKind): string {
    const errorName =
      error instanceof DOMException
        ? error.name
        : typeof error === 'object' && error !== null && 'name' in error
          ? String(error.name)
          : '';
    const errorMessage = error instanceof Error ? error.message.toLowerCase() : '';
    const isPermissionError =
      ['NotAllowedError', 'PermissionDeniedError', 'SecurityError'].includes(errorName) ||
      errorMessage.includes('permission') ||
      errorMessage.includes('denied');

    if (isPermissionError) {
      return kind === 'VIDEO'
        ? 'Autorisez le microphone et la caméra dans les paramètres du navigateur, puis réessayez.'
        : 'Autorisez le microphone dans les paramètres du navigateur, puis réessayez.';
    }

    if (errorName === 'NotFoundError' || errorMessage.includes('device not found')) {
      return kind === 'VIDEO'
        ? 'Aucun microphone ou aucune caméra utilisable n’a été détecté.'
        : 'Aucun microphone utilisable n’a été détecté.';
    }

    if (errorName === 'NotReadableError' || errorMessage.includes('could not start')) {
      return 'Le périphérique est déjà utilisé par une autre application.';
    }

    const httpMessage = getHttpErrorMessage(error, '');
    if (httpMessage) return httpMessage;

    const technicalMessage = error instanceof Error ? error.message.trim() : '';
    return technicalMessage
      ? `Impossible d'établir l'appel : ${technicalMessage}`
      : "Impossible d'établir l'appel pour le moment.";
  }

  private async clear(): Promise<void> {
    const hadCall = this.callState() !== null;
    this.callAudio.stop();
    if (this.durationTimer) clearInterval(this.durationTimer);
    this.durationTimer = null;
    await this.room?.disconnect();
    this.room = null;
    this.remoteTrackState.set([]);
    this.localVideoTrackState.set(null);
    this.durationSecondsState.set(0);
    this.callState.set(null);
    this.isOverlayVisible.set(true);
    this.isMuted.set(false);
    this.isCameraEnabled.set(true);
    this.isSpeakerEnabled.set(true);
    this.audioInputDevices.set([]);
    this.videoInputDevices.set([]);
    this.selectedAudioInputId.set(null);
    this.selectedVideoInputId.set(null);
    if (hadCall) this.historyVersion.update((version) => version + 1);
  }

  private startDurationTimer(): void {
    if (this.durationTimer) clearInterval(this.durationTimer);
    this.durationSecondsState.set(0);
    this.durationTimer = setInterval(
      () => this.durationSecondsState.update((seconds) => seconds + 1),
      1000,
    );
  }

  private async refreshMediaDevices(): Promise<void> {
    if (!navigator.mediaDevices?.enumerateDevices) return;
    const devices = await navigator.mediaDevices.enumerateDevices();
    this.audioInputDevices.set(devices.filter((device) => device.kind === 'audioinput'));
    this.videoInputDevices.set(devices.filter((device) => device.kind === 'videoinput'));
    this.selectedAudioInputId.set(
      this.audioInputDevices().find((device) => device.deviceId === 'default')?.deviceId ??
        this.audioInputDevices()[0]?.deviceId ??
        null,
    );
    this.selectedVideoInputId.set(this.videoInputDevices()[0]?.deviceId ?? null);
  }
}
