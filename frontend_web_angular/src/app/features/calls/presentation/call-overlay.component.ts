import { CommonModule } from '@angular/common';
import { AfterViewChecked, Component, ElementRef, ViewChild, inject, signal } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import { Router } from '@angular/router';
import { AuthSessionService } from '../../../core/auth/auth-session.service';
import { CallFacade } from '../application/call-facade.service';
import type { LocalVideoTrack, RemoteTrack } from 'livekit-client';

@Component({
  selector: 'app-call-overlay',
  imports: [CommonModule, LucideAngularModule],
  templateUrl: './call-overlay.component.html',
  styleUrl: './call-overlay.component.scss',
})
export class CallOverlayComponent implements AfterViewChecked {
  protected readonly calls = inject(CallFacade);
  private readonly authSession = inject(AuthSessionService);
  private readonly router = inject(Router);
  @ViewChild('remoteMedia') private remoteMedia?: ElementRef<HTMLElement>;
  @ViewChild('localVideo') private localVideo?: ElementRef<HTMLElement>;
  @ViewChild('callSurface') private callSurface?: ElementRef<HTMLElement>;
  private attachedTracks = new Set<RemoteTrack>();
  private attachedLocalTrack: LocalVideoTrack | null = null;
  protected readonly openDeviceMenu = signal<'audioinput' | 'videoinput' | null>(null);
  protected readonly isLocalVideoMain = signal(false);
  ngAfterViewChecked(): void {
    const host = this.remoteMedia?.nativeElement;
    if (!host) return;
    for (const track of this.calls.remoteTrack()) {
      if (this.attachedTracks.has(track)) continue;
      host.appendChild(track.attach());
      this.attachedTracks.add(track);
    }
    for (const element of Array.from(host.querySelectorAll<HTMLMediaElement>('audio, video'))) {
      element.muted = !this.calls.isSpeakerEnabled();
    }
    const localTrack = this.calls.localVideoTrack();
    const localHost = this.localVideo?.nativeElement;
    if (localTrack && localHost && localTrack !== this.attachedLocalTrack) {
      const element = localTrack.attach();
      element.muted = true;
      localHost.replaceChildren(element);
      this.attachedLocalTrack = localTrack;
    }
    if (!this.calls.call() && this.attachedTracks.size) {
      host.replaceChildren();
      this.attachedTracks.clear();
      localHost?.replaceChildren();
      this.attachedLocalTrack = null;
    }
  }

  protected formatDuration(totalSeconds: number): string {
    const minutes = Math.floor(totalSeconds / 60)
      .toString()
      .padStart(2, '0');
    const seconds = (totalSeconds % 60).toString().padStart(2, '0');
    return `${minutes}:${seconds}`;
  }

  protected openConversation(conversationId: string): void {
    this.calls.minimizeOverlay();
    void this.router.navigate(['/messages'], { queryParams: { conversationId } });
  }

  protected hasRemoteVideo(): boolean {
    return this.calls.remoteTrack().some((track) => track.kind === 'video');
  }

  protected ownDisplayName(): string {
    return this.authSession.currentUser()?.name || 'Vous';
  }

  protected ownAvatarUrl(): string | null {
    return this.authSession.currentUser()?.avatarUrl || null;
  }

  protected toggleDeviceMenu(kind: 'audioinput' | 'videoinput'): void {
    this.openDeviceMenu.update((current) => (current === kind ? null : kind));
  }

  protected deviceLabel(
    device: MediaDeviceInfo,
    index: number,
    kind: 'audioinput' | 'videoinput',
  ): string {
    return device.label || `${kind === 'audioinput' ? 'Microphone' : 'Caméra'} ${index + 1}`;
  }

  protected selectAudioInput(deviceId: string): void {
    void this.calls.selectAudioInput(deviceId);
    this.openDeviceMenu.set(null);
  }

  protected selectVideoInput(deviceId: string): void {
    void this.calls.selectVideoInput(deviceId);
    this.openDeviceMenu.set(null);
  }

  protected showLocalVideoAsMain(): void {
    if (this.calls.call()?.kind === 'VIDEO') this.isLocalVideoMain.set(true);
  }

  protected showRemoteVideoAsMain(): void {
    this.isLocalVideoMain.set(false);
  }

  protected toggleFullscreen(): void {
    if (document.fullscreenElement) {
      void document.exitFullscreen();
      return;
    }
    void this.callSurface?.nativeElement.requestFullscreen();
  }
}
