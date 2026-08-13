import { LatestPendingValue } from './latest-pending-value';

describe('LatestPendingValue - latest-only network contract', () => {
  it('is empty initially and after consumption', () => {
    const queue = new LatestPendingValue<string>();
    expect(queue.take()).toBeNull();
    queue.replace('A');
    expect(queue.take()).toBe('A');
    expect(queue.take()).toBeNull();
  });

  it('keeps only D when B, C and D arrive while A is in flight', () => {
    const queue = new LatestPendingValue<string>();
    queue.replace('B');
    queue.replace('C');
    queue.replace('D');
    expect(queue.take()).toBe('D');
  });

  it.each([2_000, 4_000, 6_000])(
    'sends only the newest pending value after a %i ms ACK',
    (ackDelayMs) => {
      vi.useFakeTimers();
      const queue = new LatestPendingValue<string>();
      let next: string | null = null;
      window.setTimeout(() => { next = queue.take(); }, ackDelayMs);
      queue.replace('B');
      queue.replace('C');
      queue.replace('D');
      vi.advanceTimersByTime(ackDelayMs);
      expect(next).toBe('D');
      expect(queue.take()).toBeNull();
      vi.useRealTimers();
    },
  );

  it('preserves object identity for the exact latest GPS sample', () => {
    const queue = new LatestPendingValue<{ recordedAt: number }>();
    const latest = { recordedAt: 3 };
    queue.replace({ recordedAt: 1 });
    queue.replace(latest);
    expect(queue.take()).toBe(latest);
  });
});
