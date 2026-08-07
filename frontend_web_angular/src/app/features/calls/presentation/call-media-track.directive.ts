import { Directive, ElementRef, Input, OnDestroy, inject } from '@angular/core';
import type { LocalVideoTrack, RemoteTrack } from 'livekit-client';

type AttachableTrack = LocalVideoTrack | RemoteTrack;

@Directive({ selector: '[appCallMediaTrack]' })
export class CallMediaTrackDirective implements OnDestroy {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private track: AttachableTrack | null = null;
  private element: HTMLMediaElement | null = null;
  private muted = false;
  private syncVersion = 0;

  @Input({ required: true })
  set appCallMediaTrack(track: AttachableTrack | null) {
    if (track === this.track && this.element && this.host.contains(this.element)) return;
    this.detach();
    this.track = track;
    this.scheduleSync();
  }

  @Input()
  set callMediaMuted(muted: boolean) {
    this.muted = muted;
    if (this.element) this.element.muted = muted;
  }

  ngOnDestroy(): void {
    this.syncVersion += 1;
    this.detach();
    this.track = null;
  }

  private scheduleSync(): void {
    const version = ++this.syncVersion;
    queueMicrotask(() => {
      if (version !== this.syncVersion || !this.track) return;
      const element = this.track.attach();
      element.autoplay = true;
      if (element instanceof HTMLVideoElement) element.playsInline = true;
      element.muted = this.muted;
      this.host.replaceChildren(element);
      this.element = element;
    });
  }

  private detach(): void {
    if (this.track && this.element) this.track.detach(this.element);
    this.element?.remove();
    this.element = null;
    this.host.replaceChildren();
  }
}
