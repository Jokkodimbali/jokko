import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { catchError, finalize, of } from 'rxjs';
import { AuthSessionService } from '../../../core/auth/auth-session.service';
import { AppFeedbackService } from '../../../core/feedback/app-feedback.service';
import { AuthService } from '../../../features/auth/data-access/auth.service';
import { AUTH_UI_MESSAGES } from '../../../features/auth/domain/auth-ui.messages';

interface AppNavItem {
  label: string;
  icon: 'users' | 'heart-plus' | 'calendar-days' | 'message-circle';
  route: string;
}

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule, RouterLink, LucideAngularModule],
  templateUrl: './app-navbar.component.html',
  styleUrl: './app-navbar.component.scss',
})
export class AppNavbarComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly authSession = inject(AuthSessionService);
  private readonly authService = inject(AuthService);
  private readonly feedback = inject(AppFeedbackService);

  protected readonly logo = '/logo.png';
  protected readonly feedbackMessage = this.feedback.message;
  protected readonly currentUser = this.authSession.currentUser;
  protected readonly isMenuOpen = signal(false);
  protected readonly isMobileNavOpen = signal(false);
  protected readonly isLoggingOut = signal(false);
  protected readonly isAuthenticated = computed(() => !!this.currentUser());
  protected readonly profileAvatarUrl = computed(() => this.currentUser()?.avatarUrl || null);
  protected readonly profileLabel = computed(() => {
    const user = this.currentUser();
    if (!user) return '';

    return (
      user.name
        .split(' ')
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase())
        .join('') || 'U'
    );
  });
  protected readonly profileTitle = computed(() => {
    const user = this.currentUser();
    return user ? `${user.name} (${user.role})` : 'Connexion';
  });
  protected readonly profileName = computed(() => this.currentUser()?.name || 'Mon Compte');

  protected readonly navItems = signal<AppNavItem[]>([
    {
      label: 'Services',
      icon: 'users',
      route: '/services',
    },
    {
      label: 'Médecine',
      icon: 'heart-plus',
      route: '/medecine',
    },
    {
      label: 'Rendez vous',
      icon: 'calendar-days',
      route: '/appointments',
    },
    {
      label: 'Message',
      icon: 'message-circle',
      route: '/messages',
    },
  ]);

  protected isActive(route: string): boolean {
    return this.router.url.startsWith(route);
  }

  protected toggleProfileMenu(): void {
    if (!this.isAuthenticated()) return;
    this.isMenuOpen.update((isOpen) => !isOpen);
  }

  protected closeProfileMenu(): void {
    this.isMenuOpen.set(false);
  }

  protected toggleMobileNav(): void {
    this.isMobileNavOpen.update((v) => !v);
    if (this.isMobileNavOpen()) this.closeProfileMenu();
  }

  protected closeMobileNav(): void {
    this.isMobileNavOpen.set(false);
  }

  protected logout(): void {
    this.closeProfileMenu();
    this.closeMobileNav();

    this.isLoggingOut.set(true);
    this.authService
      .logout()
      .pipe(
        catchError(() => of(undefined)),
        finalize(() => {
          this.authSession.clear();
          this.isLoggingOut.set(false);
          this.feedback.success(AUTH_UI_MESSAGES.logoutSuccess);
          this.router.navigate(['/services']);
        }),
      )
      .subscribe();
  }

  ngOnInit(): void {
    if (!this.authSession.getAccessToken()) return;

    this.authService
      .myUserProfile()
      .pipe(
        catchError(() => {
          if (!this.currentUser()) {
            this.authSession.clear();
          }
          return of(null);
        }),
      )
      .subscribe((profile) => {
        if (profile) {
          this.authSession.saveUserProfile(profile);
        }
      });
  }
}
