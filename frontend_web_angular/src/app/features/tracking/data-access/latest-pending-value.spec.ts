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
});
