import { LatestPendingValue } from './latest-pending-value';

describe('LatestPendingValue', () => {
  it('keeps only D while A is in flight and B, C, D arrive', () => {
    const pending = new LatestPendingValue<string>();

    pending.replace('B');
    pending.replace('C');
    pending.replace('D');

    expect(pending.take()).toBe('D');
    expect(pending.take()).toBeNull();
  });

  it.each([2_000, 6_000])('keeps only the latest sample during a %i ms ACK', (ackDelayMs) => {
    vi.useFakeTimers();
    const pending = new LatestPendingValue<string>();
    let sentAfterAck: string | null = null;

    window.setTimeout(() => {
      sentAfterAck = pending.take();
    }, ackDelayMs);
    pending.replace('B');
    pending.replace('C');
    pending.replace('D');
    vi.advanceTimersByTime(ackDelayMs);

    expect(sentAfterAck).toBe('D');
    expect(pending.take()).toBeNull();
    vi.useRealTimers();
  });
});
