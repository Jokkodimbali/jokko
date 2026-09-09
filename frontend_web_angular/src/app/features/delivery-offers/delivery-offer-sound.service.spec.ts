import { TestBed } from '@angular/core/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { DeliveryOfferSoundService } from './delivery-offer-sound.service';

describe('delivery offer sound', () => {
  afterEach(() => {
    TestBed.resetTestingModule();
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });
  it('repeats until stopped and stops all scheduled tones immediately', async () => {
    vi.useFakeTimers();
    const oscillators: Array<{
      stop: ReturnType<typeof vi.fn>;
      disconnect: ReturnType<typeof vi.fn>;
    }> = [];
    class FakeAudioContext {
      state = 'running';
      currentTime = 0;
      destination = {};
      resume = vi.fn().mockResolvedValue(undefined);
      close = vi.fn().mockResolvedValue(undefined);
      createGain() {
        return {
          gain: { setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn() },
          connect: vi.fn(),
          disconnect: vi.fn(),
        };
      }
      createOscillator() {
        const oscillator = {
          frequency: { value: 0 },
          connect: vi.fn(),
          disconnect: vi.fn(),
          start: vi.fn(),
          stop: vi.fn(),
          onended: null,
        };
        oscillators.push(oscillator);
        return oscillator;
      }
    }
    vi.stubGlobal('AudioContext', FakeAudioContext);
    TestBed.configureTestingModule({ providers: [DeliveryOfferSoundService] });
    const sound = TestBed.inject(DeliveryOfferSoundService);
    sound.start();
    await Promise.resolve();
    vi.advanceTimersByTime(8000);
    expect(oscillators.length).toBe(6);
    sound.stop();
    expect(oscillators.every((node) => node.disconnect.mock.calls.length > 0)).toBe(true);
    vi.advanceTimersByTime(8000);
    expect(oscillators.length).toBe(6);
  });
});
