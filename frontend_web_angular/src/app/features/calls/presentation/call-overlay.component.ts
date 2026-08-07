import { CommonModule } from '@angular/common';
import { Component, ElementRef, ViewChild, inject, signal } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';
import { Router } from '@angular/router';
import { AuthSessionService } from '../../../core/auth/auth-session.service';
import { CallFacade } from '../application/call-facade.service';
import type { RemoteTrack } from 'livekit-client';
import { CallMediaTrackDirective } from './call-media-track.directive';

@Component({
  selector: 'app-call-overlay',
  imports: [CommonModule, LucideAngularModule, CallMediaTrackDirective],
  templateUrl: './call-overlay.component.html',
  styleUrl: './call-overlay.component.scss',
})
export class CallOverlayComponent {
  protected readonly calls = inject(CallFacade);
  private readonly authSession = inject(AuthSessionService);
  private readonly router = inject(Router);
  @ViewChild('callSurface') private callSurface?: ElementRef<HTMLElement>;
  protected readonly openDeviceMenu = signal<'audioinput' | 'videoinput' | null>(null);
  protected readonly isLocalVideoMain = signal(false);
  protected readonly floatingPosition = signal<{ x: number; y: number } | null>(null);
  private floatingDrag: {
    pointerId: number;
    offsetX: number;
    offsetY: number;
    element: HTMLElement;
  } | null = null;
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
    const muted = this.calls.mutedRemoteTrackIds();
    return this.calls
      .remoteTrack()
      .some(
        (track) =>
          track.kind === 'video' && !track.isMuted && (!track.sid || !muted.has(track.sid)),
      );
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

  protected cameraChoices(): Array<{ device: MediaDeviceInfo; label: string }> {
    const devices = this.calls.videoInputDevices();
    if (devices.length === 0) return [];

    const matches = (device: MediaDeviceInfo, pattern: RegExp): boolean =>
      pattern.test(
        device.label
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .toLowerCase(),
      );
    const frontPattern = /front|face|user|avant/;
    const rearPattern = /back|rear|environment|world|arriere|dos/;
    const front = devices.find((device) => matches(device, frontPattern)) ?? devices[0];
    const rear =
      devices.find(
        (device) => device.deviceId !== front.deviceId && matches(device, rearPattern),
      ) ?? devices.find((device) => device.deviceId !== front.deviceId);

    const choices = [{ device: front, label: devices.length === 1 ? 'Caméra' : 'Caméra avant' }];
    if (rear) choices.push({ device: rear, label: 'Caméra arrière' });
    return choices;
  }

  protected isRearCameraSelected(): boolean {
    const rearCamera = this.cameraChoices().find((choice) => choice.label === 'Caméra arrière');
    return rearCamera?.device.deviceId === this.calls.selectedVideoInputId();
  }

  protected showLocalVideoAsMain(): void {
    if (this.calls.call()?.kind === 'VIDEO') this.isLocalVideoMain.set(true);
  }

  protected showRemoteVideoAsMain(): void {
    this.isLocalVideoMain.set(false);
  }

  protected toggleFullscreen(): void {
    if (!this.calls.isOverlayVisible()) {
      this.calls.showOverlay();
      return;
    }
    if (document.fullscreenElement) {
      void document.exitFullscreen();
      return;
    }
    void this.callSurface?.nativeElement.requestFullscreen();
  }

  protected startFloatingDrag(event: PointerEvent): void {
    if (event.button !== 0 || (event.target as HTMLElement).closest('button')) return;
    const element = event.currentTarget as HTMLElement;
    const rect = element.getBoundingClientRect();
    this.floatingDrag = {
      pointerId: event.pointerId,
      offsetX: event.clientX - rect.left,
      offsetY: event.clientY - rect.top,
      element,
    };
    element.setPointerCapture(event.pointerId);
    event.preventDefault();
  }

  protected moveFloatingWindow(event: PointerEvent): void {
    const drag = this.floatingDrag;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const viewportWidth = window.visualViewport?.width ?? window.innerWidth;
    const viewportHeight = window.visualViewport?.height ?? window.innerHeight;
    const margin = 8;
    const x = Math.min(
      Math.max(margin, event.clientX - drag.offsetX),
      Math.max(margin, viewportWidth - drag.element.offsetWidth - margin),
    );
    const y = Math.min(
      Math.max(margin, event.clientY - drag.offsetY),
      Math.max(margin, viewportHeight - drag.element.offsetHeight - margin),
    );
    this.floatingPosition.set({ x, y });
  }

  protected stopFloatingDrag(event: PointerEvent): void {
    const drag = this.floatingDrag;
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (drag.element.hasPointerCapture(event.pointerId)) {
      drag.element.releasePointerCapture(event.pointerId);
    }
    this.floatingDrag = null;
  }

  protected visibleRemoteTracks(): RemoteTrack[] {
    const muted = this.calls.mutedRemoteTrackIds();
    return this.calls
      .remoteTrack()
      .filter(
        (track) =>
          track.kind !== 'video' || (!track.isMuted && (!track.sid || !muted.has(track.sid))),
      );
  }
}
