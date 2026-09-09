import {
  afterEveryRender,
  Directive,
  ElementRef,
  HostListener,
  Injectable,
  inject,
  OnDestroy,
  signal,
} from '@angular/core';

/** Shares the visible bell position with overlays without mounting a second notification. */
@Injectable({ providedIn: 'root' })
export class NotificationAnchorService {
  readonly occupied = signal(false);
  readonly position = signal<{ right: number; top: number; viewportWidth: number } | null>(null);
  private readonly anchors = new Set<HTMLElement>();
  register(element: HTMLElement): void {
    this.anchors.add(element);
    this.refresh();
  }
  unregister(element: HTMLElement): void {
    this.anchors.delete(element);
    this.refresh();
  }
  refresh(): void {
    let next: { right: number; top: number; viewportWidth: number } | null = null;
    for (const element of this.anchors) {
      if (!element.getClientRects().length) continue;
      const bell = element.querySelector<HTMLElement>('.app-navbar__notification-bell') || element;
      const rect = bell.getBoundingClientRect();
      if (!rect.width || !rect.height) continue;
      next = {
        right: window.innerWidth - rect.right,
        top: rect.top,
        viewportWidth: window.innerWidth,
      };
    }
    const previous = this.position();
    if (
      previous?.right !== next?.right ||
      previous?.top !== next?.top ||
      previous?.viewportWidth !== next?.viewportWidth
    )
      this.position.set(next);
  }
}

@Directive({ selector: '[appNotificationAnchor]', standalone: true })
export class NotificationAnchorDirective implements OnDestroy {
  private readonly element = inject(ElementRef<HTMLElement>).nativeElement;
  private readonly anchors = inject(NotificationAnchorService);
  constructor() {
    this.anchors.register(this.element);
    afterEveryRender(() => this.anchors.refresh());
  }
  @HostListener('window:resize') onResize(): void {
    this.anchors.refresh();
  }
  ngOnDestroy(): void {
    this.anchors.unregister(this.element);
  }
}
