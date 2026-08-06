import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { Injectable, PLATFORM_ID, inject } from '@angular/core';

type CallTone = 'INCOMING' | 'OUTGOING';

@Injectable({ providedIn: 'root' })
export class CallAudioService {
  private readonly platformId = inject(PLATFORM_ID);
  private readonly document = inject(DOCUMENT);
  private context: AudioContext | null = null;
  private repeatTimer: ReturnType<typeof setInterval> | null = null;
  private generation = 0;

  constructor() {
    if (!isPlatformBrowser(this.platformId)) return;
    const unlock = () => void this.audioContext().resume();
    this.document.addEventListener('pointerdown', unlock, { once: true, passive: true });
    this.document.addEventListener('keydown', unlock, { once: true, passive: true });
  }

  playIncoming(): void {
    this.start('INCOMING');
  }

  playOutgoing(): void {
    this.start('OUTGOING');
  }

  stop(): void {
    this.generation += 1;
    if (this.repeatTimer) clearInterval(this.repeatTimer);
    this.repeatTimer = null;
  }

  private start(tone: CallTone): void {
    if (!isPlatformBrowser(this.platformId)) return;
    this.stop();
    const generation = this.generation;
    const play = () => {
      if (generation !== this.generation) return;
      void this.playPattern(tone);
    };
    play();
    this.repeatTimer = setInterval(play, tone === 'INCOMING' ? 4000 : 5000);
  }

  private async playPattern(tone: CallTone): Promise<void> {
    const context = this.audioContext();
    await context.resume().catch(() => undefined);
    if (context.state !== 'running') return;

    if (tone === 'INCOMING') {
      this.playBurst(context, [440, 480], 0, 0.9);
      this.playBurst(context, [440, 480], 1.15, 0.9);
      return;
    }
    this.playBurst(context, [425], 0, 1.1);
  }

  private playBurst(
    context: AudioContext,
    frequencies: number[],
    delay: number,
    duration: number,
  ): void {
    const startAt = context.currentTime + delay;
    const endAt = startAt + duration;
    const gain = context.createGain();
    gain.gain.setValueAtTime(0.0001, startAt);
    gain.gain.exponentialRampToValueAtTime(0.11, startAt + 0.03);
    gain.gain.setValueAtTime(0.11, Math.max(startAt + 0.03, endAt - 0.05));
    gain.gain.exponentialRampToValueAtTime(0.0001, endAt);
    gain.connect(context.destination);

    for (const frequency of frequencies) {
      const oscillator = context.createOscillator();
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(frequency, startAt);
      oscillator.connect(gain);
      oscillator.start(startAt);
      oscillator.stop(endAt + 0.02);
    }
  }

  private audioContext(): AudioContext {
    this.context ??= new AudioContext();
    return this.context;
  }
}
