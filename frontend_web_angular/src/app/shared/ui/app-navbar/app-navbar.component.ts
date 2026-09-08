import { CommonModule } from '@angular/common';
import {
  Component,
  EventEmitter,
  HostListener,
  OnDestroy,
  OnInit,
  Input,
  Output,
  computed,
  effect,
  untracked,
  inject,
  signal,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { EMPTY, Subscription, catchError, finalize, forkJoin, of } from 'rxjs';
import { AuthSessionService } from '../../../core/auth/auth-session.service';
import {
  isDoctorAccount,
  isProviderAccount,
} from '../../../core/auth/professional-space-role.utils';
import { AppFeedbackService } from '../../../core/feedback/app-feedback.service';
import { getHttpErrorMessage } from '../../../core/http/api-response.utils';
import { SessionPresenceService } from '../../../core/presence/session-presence.service';
import {
  findFeaturedNotification,
  formatNotificationTitle,
  notificationIcon,
  notificationAvatarUrl,
  notificationSubtitle,
  sortNotificationsNewestFirst,
  notificationActorName,
  NotificationsService,
  UserNotificationView,
} from '../../../core/notifications/notifications.service';
import { NotificationDisplay } from '../../../core/notifications/notification-display';
import { FeaturedNotificationCacheService } from '../../../core/notifications/featured-notification-cache.service';
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
  @Input() mobileLocationLabel = 'Votre position';
  @Input() mobileLocationStatic = false;
  @Input() mobilePageTitle = '';
  @Input() mobilePageSubtitle = '';
  @Output() mobileLocationClick = new EventEmitter<void>();
  private readonly router = inject(Router);
  private readonly authSession = inject(AuthSessionService);
  private readonly authService = inject(AuthService);
  private readonly feedback = inject(AppFeedbackService);
  private readonly notificationsService = inject(NotificationsService);
  private readonly featuredNotificationCache = inject(FeaturedNotificationCacheService);
  private readonly appointmentsService = inject(AppointmentsService);
  private readonly messagesService = inject(MessagesService);
  private readonly messagesRealtime = inject(MessagesRealtimeService);
  private readonly presence = inject(SessionPresenceService);
  private unreadMessagesIntervalId: ReturnType<typeof setInterval> | null = null;
  private notificationsIntervalId: ReturnType<typeof setInterval> | null = null;
  private infoMenuCloseTimer: ReturnType<typeof setTimeout> | null = null;
  private notificationsCloseTimer: ReturnType<typeof setTimeout> | null = null;
  private notificationPreviewRequest: Subscription | null = null;
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
  private readonly notificationHistory = signal<UserNotificationView[]>([]);
  private readonly dismissedTerminalNotificationIds = signal<ReadonlySet<string>>(new Set());
  private readonly nextFeaturedNotification = computed(() => {
    const dismissed = this.dismissedTerminalNotificationIds();
    return findFeaturedNotification(this.notificationHistory(), (id) =>
      dismissed.has(id) || this.featuredNotificationCache.isTransientDismissed(id));
  });
  private readonly notificationDisplay = new NotificationDisplay((id) => {
    this.featuredNotificationCache.dismissTransient(id);
    this.dismissedTerminalNotificationIds.update((ids) => new Set(ids).add(id));
  });
  protected readonly featuredNotification = this.notificationDisplay.notification;
  protected readonly notificationAnimationPhase = this.notificationDisplay.phase;
  private readonly syncNotificationDisplay = effect(() => {
    const notification = this.nextFeaturedNotification();
    untracked(() => this.notificationDisplay.update(notification));
  });
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
  protected readonly mobileProfileSubtitle = computed(() => {
    const role = this.currentUser()?.role;
    if (role === 'PRESTATAIRE') return 'Compte prestataire';
    if (role === 'MEDECIN') return 'Compte medecin';
    if (role === 'ADMIN') return 'Compte administrateur';
    return 'Compte client';
  });
  protected readonly showDoctorSpace = computed(() => isDoctorAccount(this.currentUser()));
  protected readonly showProviderSpace = computed(() => isProviderAccount(this.currentUser()));
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
      label: 'RDV et Négociation',
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
    this.clearInfoMenuCloseTimer();
    this.closeProfileMenu();
    this.closeNotificationsMenu();
    this.isInfoMenuOpen.set(true);
  }

  protected scheduleCloseInfoMenu(): void {
    this.clearInfoMenuCloseTimer();
    this.infoMenuCloseTimer = setTimeout(() => this.closeInfoMenu(), 140);
  }

  protected closeInfoMenu(): void {
    this.clearInfoMenuCloseTimer();
    this.isInfoMenuOpen.set(false);
  }

  private clearInfoMenuCloseTimer(): void {
    if (!this.infoMenuCloseTimer) return;
    clearTimeout(this.infoMenuCloseTimer);
    this.infoMenuCloseTimer = null;
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
    this.clearNotificationsCloseTimer();
    this.closeInfoMenu();
    this.closeProfileMenu();
    this.isNotificationsOpen.update((isOpen) => !isOpen);
    if (this.isNotificationsOpen() && this.notificationPreview().length === 0) {
      this.loadNotificationPreview();
    }
  }

  protected openNotificationsMenu(): void {
    if (!this.isAuthenticated()) return;
    this.clearNotificationsCloseTimer();
    this.closeInfoMenu();
    this.closeProfileMenu();
    this.isNotificationsOpen.set(true);
    if (this.notificationPreview().length === 0) {
      this.loadNotificationPreview();
    }
  }

  protected scheduleCloseNotificationsMenu(): void {
    this.clearNotificationsCloseTimer();
    this.notificationsCloseTimer = setTimeout(() => this.closeNotificationsMenu(), 140);
  }

  protected closeNotificationsMenu(): void {
    this.clearNotificationsCloseTimer();
    this.isNotificationsOpen.set(false);
  }

  private clearNotificationsCloseTimer(): void {
    if (!this.notificationsCloseTimer) return;
    clearTimeout(this.notificationsCloseTimer);
    this.notificationsCloseTimer = null;
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

    const refreshToken = this.authSession.getRefreshToken();
    this.featuredNotificationCache.clear(this.currentUser()?.id);
    this.isLoggingOut.set(true);
    this.presence.disconnectAuthenticatedSession();
    this.messagesRealtime.disconnect();
    this.authService
      .logout(refreshToken ? { refreshToken } : {})
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

  protected activateNotificationButton(): void {
    const notification = this.featuredNotification();
    notification ? this.openNotification(notification) : this.toggleNotificationsMenu();
  }

  private readonly failedNotificationAvatars = signal<ReadonlySet<string>>(new Set());

  protected hideNotificationAvatar(notification: UserNotificationView): void {
    const avatar = this.notificationAvatarUrl(notification);
    if (avatar) this.failedNotificationAvatars.update((urls) => new Set(urls).add(avatar));
  }

  protected notificationAvatarUrl(notification: UserNotificationView): string | null {
    const avatar = notificationAvatarUrl(notification);
    return avatar && !this.failedNotificationAvatars().has(avatar) ? avatar : null;
  }

  protected notificationActorInitials(notification: UserNotificationView): string {
    return userInitials(
      this.notificationActorName(notification) || this.notificationTitle(notification),
      'N',
    );
  }

  protected notificationActorName(notification: UserNotificationView): string | null {
    return notificationActorName(notification);
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
        const markRead = (items: UserNotificationView[]) =>
          items.map((item) =>
            item.id === notification.id
              ? { ...item, ...updated,
                  data: { ...(item.data || item.donnees || {}), ...(updated.data || updated.donnees || {}) },
                  isRead: true, estLue: true }
              : item,
          );
        this.notificationPreview.update(markRead);
        this.notificationHistory.update(markRead);
        this.syncFeaturedNotificationCache(this.notificationHistory());
        this.unreadNotificationsCount.update((count) => Math.max(0, count - 1));
        navigate();
      },
      error: (error) => {
        this.feedback.error(
          getHttpErrorMessage(error, "La notification n'a pas pu etre marquee comme lue."),
        );
        navigate();
      },
    });
  }

  protected readonly notificationTitle = formatNotificationTitle;
  protected readonly notificationSubtitle = notificationSubtitle;

  protected readonly notificationIcon = notificationIcon;

  protected notificationDate(notification: UserNotificationView): string | null {
    return notification.createdAt || notification.creeLe || null;
  }

  protected isRead(notification: UserNotificationView): boolean {
    return Boolean(notification.isRead ?? notification.estLue);
  }

  protected notificationTypeLabel(type: string, notification?: UserNotificationView): string {
    const normalized = (type || '').toLowerCase();
    const metadata = notification?.data || notification?.donnees || {};
    if (normalized.includes('ajustement')) return 'Ajustement du prix';
    if (metadata['tripStatus'] === 'SUR_PLACE') return 'Sur place';
    if (normalized.includes('en_route')) return 'Prestataire en route';
    if (normalized.includes('reservation')) return 'Reservation';
    if (normalized.includes('payment') || normalized.includes('paiement')) return 'Paiement';
    if (normalized.includes('message')) return 'Message';
    if (normalized.includes('kyc')) return 'Validation du profil';
    if (normalized.includes('litige')) return 'Litige';
    if (normalized.includes('ordonnance')) return 'Ordonnance';
    if (normalized.includes('appel')) return 'Appel';
    if (normalized.includes('annonce')) return 'Information Jokko';
    return 'Notification';
  }

  ngOnInit(): void {
    if (!this.authSession.getAccessToken()) return;

    this.restoreFeaturedNotification();
    this.loadUnreadNotificationsCount();
    this.loadNotificationPreview();
    this.loadUnreadMessagesCount();
    this.startUnreadMessagesRefresh();
    this.startNotificationsRefresh();
    this.messagesRealtime.connect();
    this.subscriptions.add(
      this.messagesRealtime.messageCreated$.subscribe((message) => {
        if (message.senderId !== this.currentUser()?.id) {
          this.unreadMessagesCount.update((count) => count + 1);
        }
      }),
    );
    this.subscriptions.add(
      this.messagesRealtime.notificationCreated$.subscribe(() => {
        // The socket only informs the intended authenticated user. Reloading
        // enriches the notification with its sender avatar before rendering.
        this.loadUnreadNotificationsCount();
        this.loadNotificationPreview(false);
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
    this.notificationPreviewRequest?.unsubscribe();
    this.clearInfoMenuCloseTimer();
    this.clearNotificationsCloseTimer();
    this.notificationDisplay.destroy();
    if (this.unreadMessagesIntervalId) {
      clearInterval(this.unreadMessagesIntervalId);
      this.unreadMessagesIntervalId = null;
    }
    if (this.notificationsIntervalId) {
      clearInterval(this.notificationsIntervalId);
      this.notificationsIntervalId = null;
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

  private loadNotificationPreview(showLoading: boolean = true): void {
    this.notificationPreviewRequest?.unsubscribe();
    if (showLoading) this.isNotificationsLoading.set(true);
    this.notificationPreviewRequest = this.notificationsService
      .list({ limit: 100 })
      .pipe(
        catchError(() => EMPTY),
        finalize(() => {
          if (showLoading) this.isNotificationsLoading.set(false);
        }),
      )
      .subscribe((notifications) => {
        const history = sortNotificationsNewestFirst(this.mergeNotificationHistory(notifications));
        this.notificationHistory.set(history);
        this.notificationPreview.set(history.slice(0, 6));
        this.syncFeaturedNotificationCache(history);
      });
  }

  private restoreFeaturedNotification(): void {
    const cached = this.featuredNotificationCache.read(this.currentUser()?.id);
    if (!cached) return;

    this.notificationHistory.set([cached]);
    this.notificationPreview.set([cached]);
  }

  private mergeNotificationHistory(notifications: UserNotificationView[]): UserNotificationView[] {
    const cached = this.featuredNotificationCache.read(this.currentUser()?.id);
    if (!cached || notifications.some((notification) => notification.id === cached.id)) {
      return notifications;
    }
    return [...notifications, cached];
  }

  private syncFeaturedNotificationCache(notifications: UserNotificationView[]): void {
    this.featuredNotificationCache.sync(this.currentUser()?.id, notifications);
  }

  private startUnreadMessagesRefresh(): void {
    this.unreadMessagesIntervalId = setInterval(() => {
      this.loadUnreadMessagesCount();
    }, 30000);
  }

  private startNotificationsRefresh(): void {
    this.notificationsIntervalId = setInterval(() => {
      this.loadUnreadNotificationsCount();
      this.loadNotificationPreview(false);
    }, 15000);
  }

  private loadUnreadMessagesCount(): void {
    this.messagesService
      .listConversations(100)
      .pipe(catchError(() => of([])))
      .subscribe((conversations) => {
        const total = conversations.reduce(
          (sum, conversation) => sum + (conversation.unreadCount || 0),
          0,
        );
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

    const disputeId = this.readMetadataString(metadata, 'disputeId');
    if (disputeId) {
      return this.currentUser()?.role === 'ADMIN'
        ? { commands: ['/admin'], queryParams: { section: 'disputes', disputeId } }
        : { commands: ['/litiges', disputeId] };
    }

    const reservationId = this.readMetadataString(metadata, 'reservationId');
    if (reservationId) return { commands: ['/appointments', reservationId], reservationId };

    const materialOrderId = this.readMetadataString(metadata, 'materialOrderId');
    if (materialOrderId) return { commands: ['/material-orders', materialOrderId] };

    const pharmacyOrderId = this.readMetadataString(metadata, 'pharmacyOrderId');
    if (pharmacyOrderId) return { commands: ['/pharmacy-orders', pharmacyOrderId] };

    const paymentId = this.readMetadataString(metadata, 'paymentId');
    if (paymentId)
      return { commands: ['/settings'], queryParams: { section: 'account', paymentId } };

    const negotiationId = this.readMetadataString(metadata, 'negotiationId');
    const professionalId = this.readMetadataString(metadata, 'professionalId');
    if (negotiationId && professionalId) {
      return {
        commands: ['/services', professionalId, 'proposition'],
        queryParams: {
          negotiationId,
          ...(this.currentUser()?.role === 'PRESTATAIRE' || this.currentUser()?.role === 'MEDECIN'
            ? { mode: 'prestataire' }
            : {}),
        },
      };
    }
    if (negotiationId) return { commands: ['/appointments'], queryParams: { negotiationId } };

    const type = (notification.type || '').toLowerCase();
    if (type.includes('message')) return { commands: ['/messages'] };
    if (type.includes('payment') || type.includes('paiement'))
      return { commands: ['/settings'], queryParams: { section: 'account' } };
    if (type.includes('kyc') || type.includes('profil')) return { commands: ['/settings'] };

    if (professionalId) return { commands: ['/services', professionalId] };
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
          this.feedback.info(
            "Cette reservation n'est plus disponible ou n'est pas accessible avec ce compte.",
          );
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
