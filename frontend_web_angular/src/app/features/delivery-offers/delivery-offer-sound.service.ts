import { DOCUMENT } from '@angular/common';
import { DestroyRef, Injectable, inject, signal } from '@angular/core';

@Injectable()
export class DeliveryOfferSoundService {
  private readonly document = inject(DOCUMENT);
  private context: AudioContext | null = null;
  private repeating: ReturnType<typeof setInterval> | null = null;
  private wanted = false;
  private readonly oscillators = new Set<OscillatorNode>();
  readonly blocked = signal(false);

  constructor() {
    const unlock = () => {
      if (this.wanted) this.enable();
    };
    this.document.addEventListener('pointerdown', unlock, { passive: true });
    this.document.addEventListener('keydown', unlock);
    inject(DestroyRef).onDestroy(() => {
      this.stop();
      this.document.removeEventListener('pointerdown', unlock);
      this.document.removeEventListener('keydown', unlock);
      void this.context?.close().catch(() => undefined);
    });
  }

  start(): void {
    if (this.wanted) return;
    this.wanted = true;
    this.enable();
    this.repeating = setInterval(() => this.ring(), 4000);
  }

  enable(): void {
    const win = this.document.defaultView as
      | (Window & { AudioContext?: typeof AudioContext })
      | null;
    if (!win?.AudioContext) {
      this.blocked.set(true);
      return;
    }
    try {
      this.context ??= new win.AudioContext();
      void this.context
        .resume()
        .then(() => {
          this.blocked.set(this.context?.state !== 'running');
          if (this.wanted && this.oscillators.size === 0) this.ring();
        })
        .catch(() => this.blocked.set(true));
      this.blocked.set(this.context.state !== 'running');
    } catch {
      this.blocked.set(true);
    }
  }

  stop(): void {
    this.wanted = false;
    if (this.repeating) clearInterval(this.repeating);
    this.repeating = null;
    for (const oscillator of this.oscillators) {
      try {
        oscillator.stop();
      } catch {
        /* Already stopped. */
      }
      oscillator.disconnect();
    }
    this.oscillators.clear();
  }

  private ring(): void {
    const context = this.context;
    if (!this.wanted || context?.state !== 'running') return;
    for (const [offset, frequency] of [
      [0, 660],
      [0.25, 880],
    ]) {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      const start = context.currentTime + offset;
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(0.09, start + 0.025);
      gain.gain.linearRampToValueAtTime(0, start + 0.22);
      oscillator.connect(gain);
      gain.connect(context.destination);
      this.oscillators.add(oscillator);
      oscillator.onended = () => {
        oscillator.disconnect();
        gain.disconnect();
        this.oscillators.delete(oscillator);
      };
      oscillator.start(start);
      oscillator.stop(start + 0.23);
    }
  }
}
