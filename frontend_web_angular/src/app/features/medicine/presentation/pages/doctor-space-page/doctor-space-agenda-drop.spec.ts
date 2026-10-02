import { describe, expect, it } from 'vitest';
import { resolveAgendaDropSlot } from './doctor-space-agenda-drop';

const week = {
  gridLeft: 100,
  gridTop: 200,
  scrollLeft: 0,
  scrollWidth: 904,
  dayCount: 7,
  rowCount: 28,
  rowHeight: 30,
};

describe('resolveAgendaDropSlot', () => {
  it('maps a drop on a weekly card to the day and half-hour underneath', () => {
    expect(resolveAgendaDropSlot({ ...week, clientX: 100 + 64 + 120 * 3 + 10, clientY: 200 + 68 + 30 * 5 + 5 }))
      .toEqual({ dayIndex: 3, rowIndex: 5 });
  });

  it('accounts for horizontal scrolling', () => {
    expect(resolveAgendaDropSlot({ ...week, scrollLeft: 240, clientX: 100 + 64 + 10, clientY: 200 + 68 + 5 }))
      .toEqual({ dayIndex: 2, rowIndex: 0 });
  });

  it('supports the single-day view', () => {
    expect(resolveAgendaDropSlot({ ...week, dayCount: 1, scrollWidth: 800, clientX: 500, clientY: 200 + 68 + 30 * 8 + 5 }))
      .toEqual({ dayIndex: 0, rowIndex: 8 });
  });

  it('rejects drops on the hour gutter or outside the calendar', () => {
    expect(resolveAgendaDropSlot({ ...week, clientX: 120, clientY: 300 })).toBeNull();
    expect(resolveAgendaDropSlot({ ...week, clientX: 200, clientY: 220 })).toBeNull();
    expect(resolveAgendaDropSlot({ ...week, clientX: 200, clientY: 1200 })).toBeNull();
  });
});
