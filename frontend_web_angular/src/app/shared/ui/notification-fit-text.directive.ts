import { afterEveryRender, Directive, ElementRef, inject, OnDestroy } from '@angular/core';

/** Keeps notification rows complete on narrow screens, without wrapping. */
@Directive({ selector: '[appNotificationFitText]', standalone: true })
export class NotificationFitTextDirective implements OnDestroy {
  private readonly element: HTMLElement = inject(ElementRef).nativeElement;
  private observer?: ResizeObserver;
  private frame = 0;
  private destroyed = false;

  constructor() {
    afterEveryRender(() => {
      if (!this.observer && typeof ResizeObserver !== 'undefined') {
        this.observer = new ResizeObserver(() => this.schedule());
        this.observer.observe(this.element);
        void document.fonts.ready.then(() => this.schedule());
      }
      this.schedule();
    });
  }

  private schedule(): void {
    if (this.destroyed) return;
    cancelAnimationFrame(this.frame);
    this.frame = requestAnimationFrame(() => this.fit());
  }

  private fit(): void {
    const rows = Array.from(this.element.querySelectorAll<HTMLElement>('strong, small'));
    for (const row of rows) {
      row.style.removeProperty('font-size');
    }
    const measurements = rows.map((row) => {
      const fontSize = parseFloat(getComputedStyle(row).fontSize);
      const icon = row.querySelector<HTMLElement>('lucide-icon');
      const gap = parseFloat(getComputedStyle(row).columnGap) || 0;
      const fixedWidth = icon ? icon.getBoundingClientRect().width + gap : 0;
      const range = document.createRange();
      range.selectNodeContents(row.querySelector('span') ?? row);
      const textWidth = range.getBoundingClientRect().width;
      return { row, fontSize, fixedWidth, textWidth };
    });
    // Keep the preferred width independent of any font reduction on narrow screens.
    const naturalWidth = Math.ceil(Math.max(0, ...measurements.map(
      ({ fixedWidth, textWidth }) => fixedWidth + textWidth,
    ))) + 1;
    this.element.style.setProperty('--notification-text-width', `${naturalWidth}px`);

    for (const { row, fontSize, fixedWidth, textWidth } of measurements) {
      const available = row.clientWidth;
      if (!available) continue;
      // Leave one pixel for subpixel rounding at fractional zoom levels.
      const textSpace = available - fixedWidth - 1;
      if (textWidth > textSpace && textSpace > 0) {
        row.style.fontSize = `${fontSize * textSpace / textWidth}px`;
      }
    }
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    this.observer?.disconnect();
    cancelAnimationFrame(this.frame);
  }
}
