import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { finalize, forkJoin } from 'rxjs';
import { AuthSessionService } from '../../../../core/auth/auth-session.service';
import {
  NotificationsService,
  UserNotificationView,
} from '../../../../core/notifications/notifications.service';
import { AppFeedbackService } from '../../../../core/feedback/app-feedback.service';
import { getHttpErrorMessage } from '../../../../core/http/api-response.utils';
import { AppFooterComponent } from '../../../../shared/ui/app-footer/app-footer.component';
import { AppNavbarComponent } from '../../../../shared/ui/app-navbar/app-navbar.component';
import { AppointmentsService } from '../../../appointments/data-access/appointments.service';

@Component({
  selector: 'app-notifications-page',
  standalone: true,
  imports: [CommonModule, RouterLink, LucideAngularModule, AppNavbarComponent, AppFooterComponent],
  templateUrl: './notifications-page.component.html',
  styleUrl: './notifications-page.component.scss',
})
export class NotificationsPageComponent implements OnInit {
  private readonly notificationsService = inject(NotificationsService);
  private readonly feedback = inject(AppFeedbackService);
  private readonly router = inject(Router);
  private readonly appointmentsService = inject(AppointmentsService);
  private readonly authSession = inject(AuthSessionService);

  protected readonly notifications = signal<UserNotificationView[]>([]);
  protected readonly isLoading = signal(false);
  protected readonly isSaving = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly unreadCount = computed(
    () => this.notifications().filter((item) => !this.isRead(item)).length,
  );
  protected readonly readCount = computed(() => this.notifications().length - this.unreadCount());

  ngOnInit(): void {
    this.loadNotifications();
  }

  protected loadNotifications(): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);
    this.notificationsService
      .list()
      .pipe(finalize(() => this.isLoading.set(false)))
      .subscribe({
        next: (notifications) => this.notifications.set(notifications),
        error: (error) => {
          this.errorMessage.set(
            getHttpErrorMessage(error, 'Impossible de charger vos notifications.'),
          );
        },
      });
  }

  protected markAllAsRead(): void {
    if (this.isSaving() || this.unreadCount() === 0) return;
    this.isSaving.set(true);
    this.notificationsService
      .markAllAsRead()
      .pipe(finalize(() => this.isSaving.set(false)))
      .subscribe({
        next: () => {
          this.notifications.update((items) =>
            items.map((item) => ({ ...item, isRead: true, estLue: true })),
          );
          this.feedback.success('Toutes vos notifications sont marquees comme lues.');
        },
        error: (error) => {
          this.feedback.error(
            getHttpErrorMessage(error, 'Impossible de marquer les notifications comme lues.'),
          );
        },
      });
  }

  protected markAsRead(notification: UserNotificationView): void {
    if (this.isRead(notification)) return;
    this.notificationsService.markAsRead(notification.id).subscribe({
      next: (updated) => {
        this.notifications.update((items) =>
          items.map((item) =>
            item.id === notification.id
              ? { ...item, ...updated, isRead: true, estLue: true }
              : item,
          ),
        );
      },
      error: (error) => {
        this.feedback.error(
          getHttpErrorMessage(error, 'Impossible de marquer cette notification comme lue.'),
        );
      },
    });
  }

  protected openNotification(notification: UserNotificationView): void {
    const target = this.resolveNotificationTarget(notification);

    if (this.isRead(notification)) {
      this.navigateToTarget(target);
      return;
    }

    this.notificationsService.markAsRead(notification.id).subscribe({
      next: (updated) => {
        this.notifications.update((items) =>
          items.map((item) =>
            item.id === notification.id
              ? { ...item, ...updated, isRead: true, estLue: true }
              : item,
          ),
        );
        this.navigateToTarget(target);
      },
      error: (error) => {
        this.feedback.error(getHttpErrorMessage(error, 'Impossible d ouvrir cette notification.'));
      },
    });
  }

  protected title(notification: UserNotificationView): string {
    return notification.title || notification.titre || this.typeLabel(notification.type);
  }

  protected body(notification: UserNotificationView): string {
    return notification.body || notification.corps || 'Notification recue sur votre compte Jokko.';
  }

  protected date(notification: UserNotificationView): string | null {
    return notification.createdAt || notification.creeLe || null;
  }

  protected isRead(notification: UserNotificationView): boolean {
    return Boolean(notification.isRead ?? notification.estLue);
  }

  protected typeLabel(type: string): string {
    const normalized = (type || '').toLowerCase();
    if (normalized.includes('ajustement')) return 'Ajustement du prix';
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

  private resolveNotificationTarget(notification: UserNotificationView): {
    commands: unknown[];
    queryParams?: Record<string, string>;
    reservationId?: string;
  } {
    const metadata = notification.data || notification.donnees || {};
    const explicitRoute = this.readMetadataString(metadata, 'route');
    if (explicitRoute?.startsWith('/')) {
      return { commands: [explicitRoute] };
    }

    const conversationId = this.readMetadataString(metadata, 'conversationId');
    if (conversationId) {
      return { commands: ['/messages'], queryParams: { conversationId } };
    }

    const disputeId = this.readMetadataString(metadata, 'disputeId');
    if (disputeId) {
      return this.authSession.currentUser()?.role === 'ADMIN'
        ? { commands: ['/admin'], queryParams: { section: 'disputes', disputeId } }
        : { commands: ['/litiges', disputeId] };
    }

    const reservationId = this.readMetadataString(metadata, 'reservationId');
    if (reservationId) {
      return { commands: ['/appointments', reservationId], reservationId };
    }

    const paymentId = this.readMetadataString(metadata, 'paymentId');
    if (paymentId) {
      return { commands: ['/settings'], queryParams: { section: 'account', paymentId } };
    }

    const professionalId = this.readMetadataString(metadata, 'professionalId');
    if (professionalId) {
      return { commands: ['/services', professionalId] };
    }

    const negotiationId = this.readMetadataString(metadata, 'negotiationId');
    const serviceId = this.readMetadataString(metadata, 'serviceId');
    if (negotiationId && serviceId) {
      const role = this.authSession.currentUser()?.role;
      return {
        commands: ['/services', serviceId, 'proposition'],
        queryParams: {
          negotiationId,
          ...(role === 'PRESTATAIRE' || role === 'MEDECIN' ? { mode: 'prestataire' } : {}),
        },
      };
    }
    if (negotiationId) {
      return { commands: ['/appointments'], queryParams: { negotiationId } };
    }

    const type = (notification.type || '').toLowerCase();
    if (type.includes('message')) return { commands: ['/messages'] };
    if (type.includes('payment') || type.includes('paiement'))
      return { commands: ['/settings'], queryParams: { section: 'account' } };
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
    const user = this.authSession.currentUser();
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
        if (exists) {
          this.router.navigate(['/appointments', reservationId]);
          return;
        }

        this.feedback.info(
          "Cette reservation n'est plus disponible ou n'est pas accessible avec ce compte.",
        );
        this.router.navigate(['/appointments']);
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
