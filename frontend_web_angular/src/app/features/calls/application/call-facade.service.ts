import { DestroyRef, Injectable, computed, effect, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { firstValueFrom } from 'rxjs';
import {
  Room,
  RoomEvent,
  Track,
  TrackEvent,
  LogLevel,
  VideoPresets,
  setLogLevel,
  type LocalTrack,
  type LocalVideoTrack,
  type RemoteTrack,
} from 'livekit-client';
import { CallsApiService } from '../data-access/calls-api.service';
import { CallsRealtimeService } from '../data-access/calls-realtime.service';
import type { ActiveCall, CallKind, CallNetworkState, CallSignal } from '../domain/call.models';
import { AuthSessionService } from '../../../core/auth/auth-session.service';
import { AppFeedbackService } from '../../../core/feedback/app-feedback.service';
import { getHttpErrorMessage } from '../../../core/http/api-response.utils';
import { CallAudioService } from '../infrastructure/call-audio.service';
import { TabSessionStorageService } from '../../../core/storage/tab-session-storage.service';

@Injectable({ providedIn: 'root' })
export class CallFacade {
  private static readonly OWNER_CALL_KEY = 'jokko.activeCallOwner';
  private readonly api = inject(CallsApiService);
  private readonly realtime = inject(CallsRealtimeService);
  private readonly auth = inject(AuthSessionService);
  private readonly feedback = inject(AppFeedbackService);
  private readonly callAudio = inject(CallAudioService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly tabStorage = inject(TabSessionStorageService);
  private readonly callState = signal<ActiveCall | null>(null);
  private readonly remoteTrackState = signal<RemoteTrack[]>([]);
  private readonly localVideoTrackState = signal<LocalVideoTrack | null>(null);
  private readonly durationSecondsState = signal(0);
  private room: Room | null = null;
  private joinPromise: Promise<void> | null = null;
  private durationTimer: ReturnType<typeof setInterval> | null = null;
  private readonly observedLocalTracks = new WeakSet<LocalTrack>();
  private clearing = false;
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
  readonly networkState = signal<CallNetworkState>('CONNECTED');
  readonly audioPlaybackBlocked = signal(false);
  readonly mutedRemoteTrackIds = signal<ReadonlySet<string>>(new Set());
  readonly isBusy = computed(() => this.callState() !== null);

  constructor() {
    setLogLevel(LogLevel.error);
    effect(() => {
      this.auth.authVersion();
      if (this.auth.currentUser()) this.realtime.connect();
      else this.realtime.disconnect();
    });
    effect(() => {
      if (this.realtime.connectionVersion() > 0) void this.resynchronizeCall();
    });
    this.realtime.events$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(({ type, signal }) => {
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
          (type === 'call.rejected' ||
            type === 'call.ended' ||
            type === 'call.missed' ||
            type === 'call.answered-elsewhere') &&
          this.matches(signal)
        ) {
          void this.clear();
        }
      });
  }

  async start(
    conversationId: string,
    kind: CallKind,
    counterpartName: string,
    counterpartAvatarUrl: string | null,
  ): Promise<void> {
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
    try {
      const confirmed = await this.realtime.emit('call.initiate', signal);
      this.callState.set({
        ...confirmed,
        phase: 'OUTGOING',
        counterpartName,
        counterpartAvatarUrl,
      });
      this.rememberOwnedCall(confirmed.callId);
      this.isOverlayVisible.set(true);
      this.callAudio.playOutgoing();
    } catch (error) {
      this.feedback.error(getHttpErrorMessage(error, "Impossible de demarrer l'appel."));
    }
  }

  async accept(): Promise<void> {
    const call = this.callState();
    if (!call) return;
    try {
      await this.realtime.emit('call.accept', call);
      this.rememberOwnedCall(call.callId);
      this.callAudio.stop();
      await this.joinRoom();
    } catch (error) {
      this.feedback.error(
        getHttpErrorMessage(error, "L'acceptation de l'appel n'a pas ete confirmee."),
      );
    }
  }

  minimizeOverlay(): void {
    this.isOverlayVisible.set(false);
  }
  showOverlay(): void {
    if (this.callState()) this.isOverlayVisible.set(true);
  }

  async reject(): Promise<void> {
    const call = this.callState();
    if (!call) return;
    try {
      await this.realtime.emit('call.reject', call);
      await this.clear();
    } catch (error) {
      this.feedback.error(getHttpErrorMessage(error, "Le rejet de l'appel n'a pas ete confirme."));
    }
  }
  async end(): Promise<void> {
    const call = this.callState();
    if (!call) return;
    try {
      await this.realtime.emit('call.end', call);
      await this.clear();
    } catch (error) {
      this.feedback.error(getHttpErrorMessage(error, "La fin de l'appel n'a pas ete confirmee."));
    }
  }

  async toggleMute(): Promise<void> {
    const room = this.room;
    if (!room) return;
    const enable = this.isMuted();
    try {
      const publication = await room.localParticipant.setMicrophoneEnabled(enable, {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        channelCount: 1,
      });
      if (enable && publication?.audioTrack) {
        this.observeLocalTrackEnd(room, publication.audioTrack, 'audio');
      }
      this.isMuted.set(!enable);
    } catch (error) {
      this.feedback.error(this.mediaDeviceErrorMessage(error, 'microphone'));
    }
  }

  async toggleCamera(): Promise<void> {
    if (this.callState()?.kind !== 'VIDEO') return;
    const room = this.room;
    if (!room) return;
    const enable = !this.isCameraEnabled();
    try {
      const publication = await room.localParticipant.setCameraEnabled(enable);
      if (enable && publication?.videoTrack) {
        this.observeLocalTrackEnd(room, publication.videoTrack, 'video');
        this.localVideoTrackState.set(publication.videoTrack);
      }
      this.isCameraEnabled.set(enable);
    } catch (error) {
      this.feedback.error(this.mediaDeviceErrorMessage(error, 'camera'));
    }
  }

  toggleSpeaker(): void {
    this.isSpeakerEnabled.update((enabled) => !enabled);
  }

  async selectAudioInput(deviceId: string): Promise<void> {
    if (!this.room) return;
    try {
      const switched = await this.room.switchActiveDevice('audioinput', deviceId, true);
      if (!switched) throw new Error('Microphone indisponible.');
      this.selectedAudioInputId.set(deviceId);
    } catch {
      this.feedback.error("Impossible d'utiliser ce microphone.");
    }
  }

  async selectVideoInput(deviceId: string): Promise<void> {
    if (!this.room || this.callState()?.kind !== 'VIDEO') return;
    try {
      const switched = await this.room.switchActiveDevice('videoinput', deviceId, true);
      if (!switched) throw new Error('Camera indisponible.');
      this.selectedVideoInputId.set(deviceId);
    } catch {
      this.feedback.error("Impossible d'utiliser cette camera.");
    }
  }

  async enableRemoteAudio(): Promise<void> {
    await this.room?.startAudio();
    this.audioPlaybackBlocked.set(false);
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
      try {
        await this.realtime.emit('call.end', call);
      } catch {
        // La resynchronisation serveur corrigera l'etat apres le retour reseau.
      }
      await this.clear();
    } finally {
      this.joinPromise = null;
    }
  }

  private async connectToRoom(call: ActiveCall): Promise<void> {
    const credential = await firstValueFrom(
      this.api.createJoinCredential(call.conversationId, call.callId),
    );
    const room = new Room({
      adaptiveStream: true,
      dynacast: true,
      videoCaptureDefaults: {
        facingMode: 'user',
        resolution: VideoPresets.h720.resolution,
      },
      publishDefaults: {
        videoEncoding: VideoPresets.h720.encoding,
      },
    });
    this.room = room;
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
    room.on(RoomEvent.TrackMuted, (publication) => {
      if (publication.trackSid) {
        this.mutedRemoteTrackIds.update((ids) => new Set(ids).add(publication.trackSid));
      }
    });
    room.on(RoomEvent.TrackUnmuted, (publication) => {
      if (publication.trackSid) {
        this.mutedRemoteTrackIds.update((ids) => {
          const next = new Set(ids);
          next.delete(publication.trackSid);
          return next;
        });
      }
    });
    room.on(RoomEvent.SignalReconnecting, () => this.networkState.set('SIGNAL_RECONNECTING'));
    room.on(RoomEvent.Reconnecting, () => this.networkState.set('RECONNECTING'));
    room.on(RoomEvent.Reconnected, () => {
      this.networkState.set('CONNECTED');
      void this.resynchronizeCall();
    });
    room.on(RoomEvent.ParticipantDisconnected, () => {
      this.networkState.set('COUNTERPART_DISCONNECTED');
    });
    room.on(RoomEvent.ParticipantConnected, () => this.networkState.set('CONNECTED'));
    room.on(RoomEvent.AudioPlaybackStatusChanged, () => {
      this.audioPlaybackBlocked.set(!room.canPlaybackAudio);
    });
    room.on(RoomEvent.MediaDevicesChanged, () => void this.refreshMediaDevices());
    room.on(RoomEvent.ActiveDeviceChanged, (kind, deviceId) => {
      if (kind === 'audioinput') this.selectedAudioInputId.set(deviceId);
      if (kind === 'videoinput') this.selectedVideoInputId.set(deviceId);
    });
    room.on(RoomEvent.MediaDevicesError, () => {
      this.feedback.error("Un peripherique audio ou video n'est plus disponible.");
      void this.refreshMediaDevices();
    });
    room.on(RoomEvent.Disconnected, () => {
      if (!this.clearing) void this.clear();
    });
    try {
      await room.connect(credential.serverUrl, credential.token);
    } catch (error) {
      await this.destroyRoom(room);
      if (this.room === room) this.room = null;
      throw error;
    }
    await this.enableInitialMedia(room, call.kind);
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

  private async enableInitialMedia(room: Room, kind: CallKind): Promise<void> {
    try {
      const publication = await room.localParticipant.setMicrophoneEnabled(true, {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
        channelCount: 1,
      });
      if (publication?.audioTrack) {
        this.observeLocalTrackEnd(room, publication.audioTrack, 'audio');
      }
      this.isMuted.set(false);
    } catch (error) {
      this.isMuted.set(true);
      this.feedback.error(this.mediaDeviceErrorMessage(error, 'microphone'));
    }

    if (kind !== 'VIDEO') return;
    try {
      const publication = await room.localParticipant.setCameraEnabled(true);
      if (publication?.videoTrack) {
        this.observeLocalTrackEnd(room, publication.videoTrack, 'video');
        this.localVideoTrackState.set(publication.videoTrack);
      }
      this.isCameraEnabled.set(true);
    } catch (error) {
      this.localVideoTrackState.set(null);
      this.isCameraEnabled.set(false);
      this.feedback.error(this.mediaDeviceErrorMessage(error, 'camera'));
    }
  }

  private mediaDeviceErrorMessage(error: unknown, device: 'microphone' | 'camera'): string {
    const label = device === 'microphone' ? 'microphone' : 'caméra';
    const action = device === 'microphone' ? 'le bouton micro' : 'le bouton caméra';
    const errorName =
      error instanceof DOMException
        ? error.name
        : typeof error === 'object' && error !== null && 'name' in error
          ? String(error.name)
          : '';
    const errorMessage = error instanceof Error ? error.message.toLowerCase() : '';
    if (
      ['NotAllowedError', 'PermissionDeniedError', 'SecurityError'].includes(errorName) ||
      errorMessage.includes('permission') ||
      errorMessage.includes('denied')
    ) {
      return `L'appel continue sans ${label}. Autorisez-le dans le navigateur puis utilisez ${action} pour l'activer.`;
    }
    if (errorName === 'NotFoundError' || errorMessage.includes('device not found')) {
      return `L'appel continue sans ${label}. Aucun périphérique compatible n'a été détecté.`;
    }
    if (errorName === 'NotReadableError' || errorMessage.includes('could not start')) {
      return `L'appel continue sans ${label}. Le périphérique est peut-être utilisé par une autre application.`;
    }
    return `L'appel continue sans ${label}. Utilisez ${action} pour réessayer.`;
  }

  private async clear(): Promise<void> {
    if (this.clearing) return;
    this.clearing = true;
    try {
      const hadCall = this.callState() !== null;
      this.callAudio.stop();
      if (this.durationTimer) clearInterval(this.durationTimer);
      this.durationTimer = null;
      const room = this.room;
      this.room = null;
      if (room) await this.destroyRoom(room);
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
      this.networkState.set('CONNECTED');
      this.audioPlaybackBlocked.set(false);
      this.mutedRemoteTrackIds.set(new Set());
      this.forgetOwnedCall();
      if (hadCall) this.historyVersion.update((version) => version + 1);
    } finally {
      this.clearing = false;
    }
  }

  private async destroyRoom(room: Room): Promise<void> {
    room.removeAllListeners();
    const localTracks = [...room.localParticipant.trackPublications.values()]
      .map((publication) => publication.track)
      .filter((track) => track !== undefined);
    for (const track of localTracks) track.stop();
    await Promise.allSettled(
      localTracks.map((track) => room.localParticipant.unpublishTrack(track)),
    );
    for (const participant of room.remoteParticipants.values()) {
      for (const publication of participant.trackPublications.values()) {
        publication.track?.detach().forEach((element) => element.remove());
      }
    }
    await room.disconnect(true).catch(() => undefined);
  }

  private observeLocalTrackEnd(room: Room, track: LocalTrack, kind: 'audio' | 'video'): void {
    if (this.observedLocalTracks.has(track)) return;
    this.observedLocalTracks.add(track);
    track.once(TrackEvent.Ended, () => {
      if (this.room !== room || this.clearing) return;
      void room.localParticipant.unpublishTrack(track).catch(() => undefined);
      if (kind === 'video') {
        this.localVideoTrackState.set(null);
        this.isCameraEnabled.set(false);
        this.feedback.error("L'acces a la camera a ete interrompu.");
      } else {
        this.isMuted.set(true);
        this.feedback.error("L'acces au microphone a ete interrompu.");
      }
    });
  }

  private async resynchronizeCall(): Promise<void> {
    if (!this.auth.currentUser()) return;
    try {
      const active = await firstValueFrom(this.api.getActiveCall());
      if (!active) {
        if (this.callState()) await this.clear();
        return;
      }
      const current = this.callState();
      if (current?.callId === active.callId) return;
      if (active.status === 'ACCEPTED' && !this.ownsCall(active.callId)) {
        if (current) await this.clear();
        return;
      }
      this.callAudio.stop();
      this.callState.set({
        ...active,
        phase:
          active.status === 'ACCEPTED'
            ? 'CONNECTING'
            : active.direction === 'INCOMING'
              ? 'INCOMING'
              : 'OUTGOING',
      });
      this.isOverlayVisible.set(true);
      if (active.status === 'ACCEPTED') await this.joinRoom();
      else if (active.direction === 'INCOMING') this.callAudio.playIncoming();
      else this.callAudio.playOutgoing();
    } catch {
      // Une indisponibilite temporaire ne doit pas detruire un appel local valide.
    }
  }

  private rememberOwnedCall(callId: string): void {
    this.tabStorage.set(CallFacade.OWNER_CALL_KEY, callId);
  }

  private ownsCall(callId: string): boolean {
    return this.tabStorage.get(CallFacade.OWNER_CALL_KEY) === callId;
  }

  private forgetOwnedCall(): void {
    this.tabStorage.remove(CallFacade.OWNER_CALL_KEY);
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
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      this.audioInputDevices.set(devices.filter((device) => device.kind === 'audioinput'));
      this.videoInputDevices.set(devices.filter((device) => device.kind === 'videoinput'));
      this.selectedAudioInputId.set(
        this.room?.getActiveDevice('audioinput') ??
          this.audioInputDevices().find((device) => device.deviceId === 'default')?.deviceId ??
          this.audioInputDevices()[0]?.deviceId ??
          null,
      );
      this.selectedVideoInputId.set(
        this.room?.getActiveDevice('videoinput') ?? this.videoInputDevices()[0]?.deviceId ?? null,
      );
    } catch {
      // L'impossibilité de lister les périphériques ne doit jamais terminer la room active.
      this.audioInputDevices.set([]);
      this.videoInputDevices.set([]);
      this.selectedAudioInputId.set(null);
      this.selectedVideoInputId.set(null);
    }
  }
}
