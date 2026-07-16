import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';

type PendingMediaKind = 'image' | 'file' | 'audio' | null;

@Component({
  selector: 'app-message-composer',
  standalone: true,
  imports: [CommonModule, LucideAngularModule],
  templateUrl: './message-composer.component.html',
  styleUrl: './message-composer.component.scss',
})
export class MessageComposerComponent {
  @Input() draft = '';
  @Input() pendingMediaUrl: string | null = null;
  @Input() pendingMediaKind: PendingMediaKind = null;
  @Input() pendingMediaLabel = '';
  @Input() isRecordingVoice = false;
  @Input() isUploadingMedia = false;
  @Input() isSending = false;
  @Input() isDisabled = false;
  @Input() hasPendingAttachment = false;
  @Input() canShowNegotiationButton = false;
  @Input() voiceRecordingSeconds = 0;
  @Input() voiceLevel = 0;

  @Output() readonly draftChange = new EventEmitter<string>();
  @Output() readonly send = new EventEmitter<void>();
  @Output() readonly imageSelected = new EventEmitter<Event>();
  @Output() readonly attachmentSelected = new EventEmitter<Event>();
  @Output() readonly clearMedia = new EventEmitter<void>();
  @Output() readonly startVoice = new EventEmitter<void>();
  @Output() readonly stopVoice = new EventEmitter<void>();
  @Output() readonly cancelVoice = new EventEmitter<void>();

  protected readonly voiceWaveIndexes = Array.from({ length: 12 }, (_, index) => index);

  protected get hasMessageContent(): boolean {
    return Boolean(this.draft.trim() || this.pendingMediaUrl || this.hasPendingAttachment);
  }

  protected get placeholder(): string {
    if (this.isDisabled) return 'Tapez votre message...';
    if (this.isRecordingVoice) return 'Parlez maintenant...';
    if (this.isUploadingMedia) return 'Preparation du media...';
    return 'Tapez votre message...';
  }

  protected updateDraftFromEvent(event: Event): void {
    this.draftChange.emit((event.target as HTMLInputElement | null)?.value ?? '');
  }

  protected formatDuration(totalSeconds: number): string {
    const seconds = Math.max(0, Math.floor(totalSeconds));
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  }

  protected voiceInsightLevel(index: number): number {
    const wave = Math.abs(Math.sin((this.voiceRecordingSeconds + index) * 0.85));
    const fallback = this.isRecordingVoice ? 0.28 + wave * 0.52 : 0.2;
    const liveLevel = Math.min(1, Math.max(0.12, this.voiceLevel * (0.55 + index * 0.08)));
    return this.isRecordingVoice && this.voiceLevel > 0.02 ? liveLevel : fallback;
  }
}
