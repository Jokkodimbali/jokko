import { CommonModule } from '@angular/common';
import { Component, HostListener, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { Subscription, catchError, finalize, forkJoin, of } from 'rxjs';
import { AuthSessionService } from '../../../core/auth/auth-session.service';
import { AppFeedbackService } from '../../../core/feedback/app-feedback.service';
import { getHttpErrorMessage } from '../../../core/http/api-response.utils';
import {
  NotificationsService,
  UserNotificationView,
} from '../../../core/notifications/notifications.service';
import { AuthService } from '../../../features/auth/data-access/auth.service';
import { AUTH_UI_MESSAGES } from '../../../features/auth/domain/auth-ui.messages';
import { AppointmentsService } from '../../../features/appointments/data-access/appointments.service';
import { MessagesRealtimeService } from '../../../features/messages/data-access/messages-realtime.service';
import { MessagesService } from '../../../features/messages/data-access/messages.service';
import { userInitials } from '../../utils/user-initials';

interface AppNavItem {
  label: string;
  icon: 'users' | 'calendar-days' | 'message-circle';
  route: string;
}

interface AppInfoNavItem {
  label: string;
  description: string;
  icon: 'building-2' | 'phone';
  route: string;
  fragment?: string;
}

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule, RouterLink, LucideAngularModule],
  templateUrl: './app-navbar.component.html',
  styleUrl: './app-navbar.component.scss',
})
export class AppNavbarComponent implements OnInit, OnDestroy {
  private readonly router = inject(Router);
  private readonly authSession = inject(AuthSessionService);
  private readonly authService = inject(AuthService);
  private readonly feedback = inject(AppFeedbackService);
  private readonly notificationsService = inject(NotificationsService);
  private readonly appointmentsService = inject(AppointmentsService);
  private readonly messagesService = inject(MessagesService);
  private readonly messagesRealtime = inject(MessagesRealtimeService);
  private unreadMessagesIntervalId: ReturnType<typeof setInterval> | null = null;
  private readonly subscriptions = new Subscription();

  protected readonly logo = '/logojokko.png';
  protected readonly currentUser = this.authSession.currentUser;
  protected readonly isMenuOpen = signal(false);
  protected readonly isMobileNavOpen = signal(false);
  protected readonly isNotificationsOpen = signal(false);
  protected readonly isInfoMenuOpen = signal(false);
  protected readonly isNotificationsLoading = signal(false);
  protected readonly isLoggingOut = signal(false);
  protected readonly unreadNotificationsCount = signal(0);
  protected readonly unreadMessagesCount = signal(0);
  protected readonly notificationPreview = signal<UserNotificationView[]>([]);
  protected readonly failedProfileAvatarUrl = signal<string | null>(null);
  protected readonly isAuthenticated = computed(() => !!this.currentUser());
  protected readonly profileAvatarUrl = computed(() => {
    const avatarUrl = this.currentUser()?.avatarUrl || null;
    return avatarUrl && avatarUrl !== this.failedProfileAvatarUrl() ? avatarUrl : null;
  });
  protected readonly profileLabel = computed(() => {
    const user = this.currentUser();
    if (!user) return '';

    return userInitials(user.name, 'U');
  });
  protected readonly profileTitle = computed(() => {
    const user = this.currentUser();
    return user ? `${user.name} (${user.role})` : 'Connexion';
  });
  protected readonly profileName = computed(() => this.currentUser()?.name || 'Mon Compte');
  protected readonly showDoctorSpace = computed(() => {
    const user = this.currentUser();
    if (!user || (user.role !== 'PRESTATAIRE' && user.role !== 'MEDECIN')) return false;

    if (user.role === 'MEDECIN') return true;

    const profile = user.professionalProfile;
    if (!profile) return false;

    const searchableText = [
      profile.nomEntreprise,
      ...(profile.categories || []),
    ]
      .filter(Boolean)
      .join(' ')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();

    return ['medecin', 'medecine', 'sante', 'docteur', 'doctor'].some((keyword) =>
      searchableText.includes(keyword),
    );
  });
  protected readonly showProviderSpace = computed(() => {
    const user = this.currentUser();
    return !!user && user.role === 'PRESTATAIRE' && !this.showDoctorSpace();
  });
  protected readonly showAdminSpace = computed(() => this.currentUser()?.role === 'ADMIN');
  protected readonly showDisputeAccess = computed(() => {
    const role = this.currentUser()?.role;
    return !!role && role !== 'ADMIN';
  });
  protected readonly notificationBadgeLabel = computed(() => {
    const count = this.unreadNotificationsCount();
    return count > 99 ? '99+' : String(count);
  });
  protected readonly messageBadgeLabel = computed(() => {
    const count = this.unreadMessagesCount();
    return count > 99 ? '99+' : String(count);
  });

  protected readonly navItems = signal<AppNavItem[]>([
    {
      label: 'Services',
      icon: 'users',
      route: '/services',
    },
    {
      label: 'RdV & Negociations',
      icon: 'calendar-days',
      route: '/appointments',
    },
    {
      label: 'Message',
      icon: 'message-circle',
      route: '/messages',
    },
  ]);
  protected readonly infoNavItems = signal<AppInfoNavItem[]>([
    {
      label: 'A propos',
      description: 'Notre mission et notre vision',
      icon: 'building-2',
      route: '/a-propos',
    },
    {
      label: 'Contact',
      description: 'Formulaire, telephone et assistance',
      icon: 'phone',
      route: '/contact',
    },
  ]);

  @HostListener('document:click', ['$event'])
  protected closeMenusOnOutsideClick(event: MouseEvent): void {
    const target = event.target;
    if (!(target instanceof Element)) return;

    if (target.closest('app-navbar')) return;

    this.closeProfileMenu();
    this.closeNotificationsMenu();
    this.closeInfoMenu();
  }

  protected isActive(route: string): boolean {
    return this.router.url.startsWith(route);
  }

  protected isInfoActive(): boolean {
    return this.infoNavItems().some((item) => this.isActive(item.route));
  }

  protected toggleInfoMenu(): void {
    this.closeProfileMenu();
    this.closeNotificationsMenu();
    this.isInfoMenuOpen.update((isOpen) => !isOpen);
  }

  protected openInfoMenu(): void {
    this.closeProfileMenu();
    this.closeNotificationsMenu();
    this.isInfoMenuOpen.set(true);
  }

  protected closeInfoMenu(): void {
    this.isInfoMenuOpen.set(false);
  }

  protected toggleProfileMenu(): void {
    if (!this.isAuthenticated()) return;
    this.closeInfoMenu();
    this.closeNotificationsMenu();
    this.isMenuOpen.update((isOpen) => !isOpen);
  }

  protected hideProfileAvatar(): void {
    const avatarUrl = this.currentUser()?.avatarUrl || null;
    this.failedProfileAvatarUrl.set(avatarUrl);
  }

  protected closeProfileMenu(): void {
    this.isMenuOpen.set(false);
  }

  protected toggleNotificationsMenu(): void {
    if (!this.isAuthenticated()) return;
    this.closeInfoMenu();
    this.closeProfileMenu();
    this.isNotificationsOpen.update((isOpen) => !isOpen);
    if (this.isNotificationsOpen() && this.notificationPreview().length === 0) {
      this.loadNotificationPreview();
    }
  }

  protected closeNotificationsMenu(): void {
    this.isNotificationsOpen.set(false);
  }

  protected toggleMobileNav(): void {
    this.isMobileNavOpen.update((v) => !v);
    if (this.isMobileNavOpen()) {
      this.closeInfoMenu();
      this.closeProfileMenu();
      this.closeNotificationsMenu();
    }
  }

  protected closeMobileNav(): void {
    this.isMobileNavOpen.set(false);
    this.closeInfoMenu();
  }

  protected logout(): void {
    this.closeProfileMenu();
    this.closeNotificationsMenu();
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
          this.router.navigate(['/auth/login']);
        }),
      )
      .subscribe();
  }

  protected openNotifications(): void {
    this.toggleNotificationsMenu();
  }

  protected openNotification(notification: UserNotificationView): void {
    const target = this.resolveNotificationTarget(notification);

    const navigate = () => {
      this.closeNotificationsMenu();
      this.closeMobileNav();
      this.navigateToTarget(target);
    };

    if (this.isRead(notification)) {
      navigate();
      return;
    }

    this.notificationsService.markAsRead(notification.id).subscribe({
      next: (updated) => {
        this.notificationPreview.update((items) =>
          items.map((item) => (item.id === notification.id ? { ...item, ...updated, isRead: true, estLue: true } : item)),
        );
        this.unreadNotificationsCount.update((count) => Math.max(0, count - 1));
        navigate();
      },
      error: (error) => this.feedback.error(getHttpErrorMessage(error, 'Impossible d ouvrir cette notification.')),
    });
  }

  protected notificationTitle(notification: UserNotificationView): string {
    return notification.title || notification.titre || this.notificationTypeLabel(notification.type);
  }

  protected notificationBody(notification: UserNotificationView): string {
    return notification.body || notification.corps || 'Notification recue sur votre compte Jokko.';
  }

  protected notificationDate(notification: UserNotificationView): string | null {
    return notification.createdAt || notification.creeLe || null;
  }

  protected isRead(notification: UserNotificationView): boolean {
    return Boolean(notification.isRead ?? notification.estLue);
  }

  protected notificationTypeLabel(type: string): string {
    const normalized = (type || '').toLowerCase();
    if (normalized.includes('reservation')) return 'Reservation';
    if (normalized.includes('payment') || normalized.includes('paiement')) return 'Paiement';
    if (normalized.includes('message')) return 'Message';
    if (normalized.includes('kyc')) return 'Validation du profil';
    return 'Notification';
  }

  ngOnInit(): void {
    if (!this.authSession.getAccessToken()) return;

    this.loadUnreadNotificationsCount();
    this.loadNotificationPreview();
    this.loadUnreadMessagesCount();
    this.startUnreadMessagesRefresh();
    this.messagesRealtime.connect();
    this.subscriptions.add(
      this.messagesRealtime.messageCreated$.subscribe((message) => {
        if (message.senderId !== this.currentUser()?.id) {
          this.unreadMessagesCount.update((count) => count + 1);
        }
      }),
    );

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
          if (profile.urlAvatar !== this.failedProfileAvatarUrl()) {
            this.failedProfileAvatarUrl.set(null);
          }
          this.authSession.saveUserProfile(profile);
        }
      });
  }

  ngOnDestroy(): void {
    if (this.unreadMessagesIntervalId) {
      clearInterval(this.unreadMessagesIntervalId);
      this.unreadMessagesIntervalId = null;
    }
    this.subscriptions.unsubscribe();
  }

  protected navItemBadgeLabel(item: AppNavItem): string | null {
    if (item.route !== '/messages' || this.unreadMessagesCount() <= 0) {
      return null;
    }

    return this.messageBadgeLabel();
  }

  private loadUnreadNotificationsCount(): void {
    this.notificationsService
      .list({ read: false, limit: 100 })
      .pipe(catchError(() => of([])))
      .subscribe((notifications) => this.unreadNotificationsCount.set(notifications.length));
  }

  private loadNotificationPreview(): void {
    this.isNotificationsLoading.set(true);
    this.notificationsService
      .list({ limit: 6 })
      .pipe(
        catchError(() => of([])),
        finalize(() => this.isNotificationsLoading.set(false)),
      )
      .subscribe((notifications) => {
        this.notificationPreview.set(notifications);
        this.unreadNotificationsCount.set(notifications.filter((item) => !this.isRead(item)).length);
      });
  }

  private startUnreadMessagesRefresh(): void {
    this.unreadMessagesIntervalId = setInterval(() => {
      this.loadUnreadMessagesCount();
    }, 30000);
  }

  private loadUnreadMessagesCount(): void {
    this.messagesService
      .listConversations(100)
      .pipe(catchError(() => of([])))
      .subscribe((conversations) => {
        const total = conversations.reduce((sum, conversation) => sum + (conversation.unreadCount || 0), 0);
        this.unreadMessagesCount.set(total);
      });
  }

  private resolveNotificationTarget(notification: UserNotificationView): {
    commands: unknown[];
    queryParams?: Record<string, string>;
    reservationId?: string;
  } {
    const metadata = notification.data || notification.donnees || {};
    const explicitRoute = this.readMetadataString(metadata, 'route');
    if (explicitRoute?.startsWith('/')) return { commands: [explicitRoute] };

    const conversationId = this.readMetadataString(metadata, 'conversationId');
    if (conversationId) return { commands: ['/messages'], queryParams: { conversationId } };

    const reservationId = this.readMetadataString(metadata, 'reservationId');
    if (reservationId) return { commands: ['/appointments', reservationId], reservationId };

    const paymentId = this.readMetadataString(metadata, 'paymentId');
    if (paymentId) return { commands: ['/settings'], queryParams: { section: 'account', paymentId } };

    const professionalId = this.readMetadataString(metadata, 'professionalId');
    if (professionalId) return { commands: ['/services', professionalId] };

    const type = (notification.type || '').toLowerCase();
    if (type.includes('message')) return { commands: ['/messages'] };
    if (type.includes('payment') || type.includes('paiement')) return { commands: ['/settings'], queryParams: { section: 'account' } };
    if (type.includes('kyc') || type.includes('profil')) return { commands: ['/settings'] };
    return { commands: ['/notifications'] };
  }

  private navigateToTarget(target: {
    commands: unknown[];
    queryParams?: Record<string, string>;
    reservationId?: string;
  }): void {
    if (target.reservationId) {
      this.navigateToReservationTarget(target.reservationId);
      return;
    }

    this.router.navigate(target.commands, { queryParams: target.queryParams });
  }

  private navigateToReservationTarget(reservationId: string): void {
    const user = this.currentUser();
    const requests =
      user?.role === 'MEDECIN' || user?.role === 'PRESTATAIRE'
        ? [
            this.appointmentsService.listMyAppointments('CLIENT'),
            this.appointmentsService.listMyAppointments('PRESTATAIRE'),
          ]
        : [this.appointmentsService.listMyAppointments('CLIENT')];

    forkJoin(requests).subscribe({
      next: (groups) => {
        const exists = groups.flat().some((appointment) => appointment.id === reservationId);
        this.router.navigate(exists ? ['/appointments', reservationId] : ['/appointments']);
        if (!exists) {
          this.feedback.info("Cette reservation n'est plus disponible ou n'est pas accessible avec ce compte.");
        }
      },
      error: () => {
        this.feedback.info('Impossible de verifier cette reservation pour le moment.');
        this.router.navigate(['/appointments']);
      },
    });
  }

  private readMetadataString(metadata: Record<string, unknown>, key: string): string | null {
    const value = metadata[key];
    return typeof value === 'string' && value.trim() ? value.trim() : null;
  }
}
