import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Component, HostListener, Inject, Input, OnInit, PLATFORM_ID, signal } from '@angular/core';
import { LucideAngularModule } from 'lucide-angular';

@Component({
  selector: 'app-scroll-hint',
  standalone: true,
  imports: [CommonModule, LucideAngularModule],
  templateUrl: './app-scroll-hint.component.html',
  styleUrl: './app-scroll-hint.component.scss',
})
export class AppScrollHintComponent implements OnInit {
  @Input() label = 'Glissez vers le bas';
  @Input() scrollRatio = 0.82;
  @Input() hideOnMobile = false;

  protected readonly visible = signal(false);

  constructor(@Inject(PLATFORM_ID) private readonly platformId: object) {}

  ngOnInit(): void {
    queueMicrotask(() => this.updateVisibility());
  }

  @HostListener('window:scroll')
  onWindowScroll(): void {
    this.updateVisibility();
  }

  @HostListener('window:resize')
  onWindowResize(): void {
    this.updateVisibility();
  }

  protected scrollDown(): void {
    if (!isPlatformBrowser(this.platformId)) return;

    window.scrollBy({
      top: Math.max(320, window.innerHeight * this.scrollRatio),
      behavior: 'smooth',
    });
    window.setTimeout(() => this.updateVisibility(), 450);
  }

  private updateVisibility(): void {
    if (!isPlatformBrowser(this.platformId)) return;

    const documentHeight = document.documentElement.scrollHeight;
    const viewportBottom = window.scrollY + window.innerHeight;
    this.visible.set(documentHeight > viewportBottom + 96);
  }
}
