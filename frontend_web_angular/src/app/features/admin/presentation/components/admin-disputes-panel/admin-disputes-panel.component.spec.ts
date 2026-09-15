import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminDisputesPanelComponent } from './admin-disputes-panel.component';

describe('AdminDisputesPanelComponent relative time', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-15T12:03:29.999Z'));
    TestBed.configureTestingModule({ imports: [AdminDisputesPanelComponent] });
    TestBed.overrideComponent(AdminDisputesPanelComponent, {
      set: { template: `{{ relativeTime('2026-09-15T12:00:00Z') }}` },
    });
  });

  afterEach(() => {
    TestBed.resetTestingModule();
    vi.useRealTimers();
  });

  it('keeps the label stable between checks, then refreshes on the clock tick', () => {
    const fixture = TestBed.createComponent(AdminDisputesPanelComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent.trim()).toBe('Il y a 3 min');

    vi.setSystemTime(new Date('2026-09-15T12:03:30Z'));
    expect(() => fixture.checkNoChanges()).not.toThrow();

    vi.advanceTimersByTime(30_000);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent.trim()).toBe('Il y a 4 min');
    expect(() => fixture.checkNoChanges()).not.toThrow();

    fixture.destroy();
    expect(vi.getTimerCount()).toBe(0);
  });
});
