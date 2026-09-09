import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  AnimatedNotificationDisplay,
  NotificationDisplay,
  NOTIFICATION_DISPLAY_MS,
  NOTIFICATION_TRANSITION_MS,
} from './notification-display';

const message = { id: 'message', type: 'NOUVEAU_MESSAGE' };
describe('animated notifications', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('keeps a notification visible for 15 seconds and mounted during its exit', () => {
    const dismiss = vi.fn();
    const display = new NotificationDisplay(dismiss);
    display.update(message);
    expect(display.phase()).toBe('entering');
    vi.advanceTimersByTime(NOTIFICATION_TRANSITION_MS);
    expect(display.phase()).toBe('visible');
    vi.advanceTimersByTime(NOTIFICATION_DISPLAY_MS - 1);
    expect(dismiss).not.toHaveBeenCalled();
    display.update({ ...message });
    vi.advanceTimersByTime(1);
    expect(dismiss).toHaveBeenCalledWith(message.id);
    expect(display.phase()).toBe('leaving');
    expect(display.notification()).toEqual(message);
    vi.advanceTimersByTime(NOTIFICATION_TRANSITION_MS);
    expect(display.notification()).toBeNull();
  });

  it('animates replacement and shows only the latest arrival during exit', () => {
    const display = new NotificationDisplay(vi.fn());
    display.update(message);
    vi.advanceTimersByTime(NOTIFICATION_TRANSITION_MS);
    display.update({ ...message, id: 'second' });
    display.update({ ...message, id: 'latest' });
    expect(display.notification()?.id).toBe('message');
    vi.advanceTimersByTime(NOTIFICATION_TRANSITION_MS);
    expect(display.notification()?.id).toBe('latest');
    expect(display.phase()).toBe('entering');
    display.destroy();
  });

  it('keeps ongoing services persistent and animates their removal', () => {
    const dismiss = vi.fn();
    const display = new NotificationDisplay(dismiss);
    display.update({ id: 'ongoing', type: 'PRESTATION_EN_COURS' });
    vi.advanceTimersByTime(60_000);
    expect(dismiss).not.toHaveBeenCalled();
    expect(display.notification()?.id).toBe('ongoing');
    display.update(null);
    expect(display.phase()).toBe('leaving');
    vi.advanceTimersByTime(NOTIFICATION_TRANSITION_MS);
    expect(display.notification()).toBeNull();
  });

  it('cleans up timers when the navbar is destroyed', () => {
    const dismiss = vi.fn();
    const display = new NotificationDisplay(dismiss);
    display.update(message);
    display.destroy();
    vi.advanceTimersByTime(60_000);
    expect(dismiss).not.toHaveBeenCalled();
  });
});

describe('persistent delivery animation', () => {
  it('keeps the offer mounted during resolution and retains the latest queued offer', () => {
    vi.useFakeTimers();
    const display = new AnimatedNotificationDisplay<{ id: string }>(
      () => {},
      () => true,
    );
    try {
      display.update({ id: 'first' });
      vi.advanceTimersByTime(60_000);
      expect(display.notification()?.id).toBe('first');
      display.update(null);
      expect(display.phase()).toBe('leaving');
      expect(display.notification()?.id).toBe('first');
      display.update({ id: 'next' });
      vi.advanceTimersByTime(NOTIFICATION_TRANSITION_MS);
      expect(display.notification()?.id).toBe('next');
      expect(display.phase()).toBe('entering');
    } finally {
      display.destroy();
      vi.useRealTimers();
    }
  });
});


it('does not expire an arrival notification after fifteen seconds', () => {
  vi.useFakeTimers();
  const dismiss = vi.fn();
  const display = new NotificationDisplay(dismiss);
  try {
    display.update({ id: 'arrival', type: 'PRESTATAIRE_EN_ROUTE', data: { tripStatus: 'SUR_PLACE', reservationId: 'r1' } });
    vi.advanceTimersByTime(120_000);
    expect(display.notification()?.id).toBe('arrival');
    expect(dismiss).not.toHaveBeenCalled();
    display.update(null);
    expect(display.phase()).toBe('leaving');
    vi.advanceTimersByTime(NOTIFICATION_TRANSITION_MS);
    expect(display.notification()).toBeNull();
  } finally { display.destroy(); vi.useRealTimers(); }
});
