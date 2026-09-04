import { CommonModule } from '@angular/common';
import { Component, computed, effect, inject } from '@angular/core';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { LucideAngularModule } from 'lucide-angular';
import { filter, map, startWith } from 'rxjs';
import { AppFeedbackService } from './core/feedback/app-feedback.service';
import { InlineFormValidationService } from './core/forms/inline-form-validation.service';
import { SessionPresenceService } from './core/presence/session-presence.service';
import { CallOverlayComponent } from './features/calls/presentation/call-overlay.component';
import { AppNavbarComponent } from './shared/ui/app-navbar/app-navbar.component';
import { AppNavbarPresentationService } from './shared/ui/app-navbar/app-navbar-presentation.service';
import { AuthSessionService } from './core/auth/auth-session.service';
import { MessagesRealtimeService } from './features/messages/data-access/messages-realtime.service';

@Component({
  selector: 'app-root',
  imports: [
    CommonModule,
    RouterOutlet,
    LucideAngularModule,
    CallOverlayComponent,
    AppNavbarComponent,
  ],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  private readonly feedback = inject(AppFeedbackService);
  private readonly inlineFormValidation = inject(InlineFormValidationService);
  private readonly sessionPresence = inject(SessionPresenceService);
  private readonly authSession = inject(AuthSessionService);
  private readonly messagesRealtime = inject(MessagesRealtimeService);
  private readonly router = inject(Router);
  protected readonly navbarPresentation = inject(AppNavbarPresentationService);

  private readonly currentUrl = toSignal(
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      map((event) => event.urlAfterRedirects),
      startWith(this.router.url),
    ),
    { initialValue: this.router.url },
  );

  protected readonly feedbackMessage = this.feedback.message;
  protected readonly showNavbar = computed(() => this.isNavbarRoute(this.currentUrl()));
  protected readonly navbarMobileLocationStatic = computed(
    () => this.normalizedPath(this.currentUrl()) === '/services',
  );
  protected readonly navbarMobilePageTitle = computed(() => {
    const path = this.normalizedPath(this.currentUrl());
    if (path === '/appointments') return 'Rendez-vous';
    if (path === '/messages') return 'Messages';
    return '';
  });
  protected readonly navbarMobilePageSubtitle = computed(() => {
    const path = this.normalizedPath(this.currentUrl());
    if (path === '/appointments') return 'Gérez vos consultations';
    if (path === '/messages') return 'Échangez avec vos contacts';
    return '';
  });

  constructor() {
    this.inlineFormValidation.install();
    effect(() => {
      this.authSession.authVersion();
      if (this.authSession.getAccessToken()) {
        this.messagesRealtime.connect();
      } else {
        this.messagesRealtime.disconnect();
      }
    });
  }

  private isNavbarRoute(url: string): boolean {
    const path = this.normalizedPath(url);
    if (
      path === '/services' ||
      path === '/favorites' ||
      path === '/notifications' ||
      path === '/appointments' ||
      path === '/messages' ||
      path === '/contact' ||
      path === '/a-propos'
    ) {
      return true;
    }

    if (/^\/services\/[^/]+$/.test(path)) return true;
    return /^\/medecine\/(?!espace$|reservations\/)[^/]+$/.test(path);
  }

  private normalizedPath(url: string): string {
    return (url.split(/[?#]/, 1)[0] || '/').replace(/\/$/, '') || '/';
  }
}
