import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { Subscription, catchError, finalize, of } from 'rxjs';
import { AuthSessionService } from '../../../../core/auth/auth-session.service';
import { getHttpErrorMessage } from '../../../../core/http/api-response.utils';
import { AppNavbarComponent } from '../../../../shared/ui/app-navbar/app-navbar.component';
import { AppointmentsService } from '../../../appointments/data-access/appointments.service';
import { ReservationDisputeView } from '../../../appointments/domain/appointments.models';
import {
  DisputeMediationRealtimeMessage,
  MessagesRealtimeService,
} from '../../../messages/data-access/messages-realtime.service';
import { MessagesService } from '../../../messages/data-access/messages.service';
import { ConversationMessage } from '../../../messages/domain/models/messages.models';

type DisputeThreadRole = 'ADMIN' | 'CLIENT' | 'PRESTATAIRE';

interface DisputeThreadItem {
  id: string;
  authorId: string;
  authorName: string;
  role: DisputeThreadRole;
  content: string;
  mediaUrl: string | null;
  createdAt: string | Date;
  source: 'CONVERSATION' | 'MEDIATION';
}

@Component({
  selector: 'app-dispute-messages-page',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideAngularModule, AppNavbarComponent],
  templateUrl: './dispute-messages-page.component.html',
  styleUrl: './dispute-messages-page.component.scss',
})
export class DisputeMessagesPageComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly appointmentsService = inject(AppointmentsService);
  private readonly messagesService = inject(MessagesService);
  private readonly messagesRealtime = inject(MessagesRealtimeService);
  private readonly authSession = inject(AuthSessionService);

  protected readonly dispute = signal<ReservationDisputeView | null>(null);
  protected readonly thread = signal<DisputeThreadItem[]>([]);
  protected readonly conversationId = signal<string | null>(null);
  protected readonly draft = signal('');
  protected readonly isLoading = signal(true);
  protected readonly isSending = signal(false);
  protected readonly isPreparingConversation = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  private realtimeSubscription = new Subscription();

  protected readonly currentUser = this.authSession.currentUser;
  protected readonly suspendedAmount = computed(() => {
    const dispute = this.dispute();
    return this.disputeAmount(dispute);
  });

  ngOnInit(): void {
    this.loadDispute();
    this.startRealtime();
  }

  ngOnDestroy(): void {
    this.realtimeSubscription.unsubscribe();
    this.messagesRealtime.disconnect();
  }

  protected goBack(): void {
    const reservationId = this.route.snapshot.paramMap.get('id');
    this.router.navigate(reservationId ? ['/litiges', reservationId, 'suivi'] : ['/litiges']);
  }

  protected openTracking(): void {
    const reservationId = this.route.snapshot.paramMap.get('id');
    this.router.navigate(reservationId ? ['/litiges', reservationId, 'suivi'] : ['/litiges']);
  }

  protected updateDraft(value: string): void {
    this.draft.set(value);
  }

  protected sendMessage(): void {
    const content = this.draft().trim();
    const conversationId = this.conversationId();
    if (!content || !conversationId || this.isSending()) return;

    this.isSending.set(true);
    this.errorMessage.set(null);
    this.messagesService
      .sendMessage(conversationId, content)
      .pipe(finalize(() => this.isSending.set(false)))
      .subscribe({
        next: (message) => {
          this.upsertThreadItem(this.mapRealtimeMessage(message));
          this.draft.set('');
        },
        error: (error) => {
          this.errorMessage.set(getHttpErrorMessage(error, "Impossible d'envoyer ce message."));
        },
      });
  }

  protected isOwnMessage(item: DisputeThreadItem): boolean {
    return item.authorId === this.currentUser()?.id;
  }

  protected statusLabel(dispute: ReservationDisputeView): string {
    const labels: Record<string, string> = {
      OUVERT: 'Litige en cours',
      EN_REVUE: 'Examen des preuves en cours',
      RESOLU: 'Litige resolu',
      REJETE: 'Litige rejete',
    };
    return labels[dispute.statut] ?? dispute.statut;
  }

  protected shortRef(dispute: ReservationDisputeView): string {
    return `#${dispute.id.slice(0, 4).toUpperCase()}`;
  }

  protected formatMoney(amount: number): string {
    return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(amount);
  }

  protected disputeAmount(dispute: ReservationDisputeView | null): number {
    return dispute?.payment?.montant ?? dispute?.reservation.prixConvenu ?? dispute?.reservation.service.prix ?? 0;
  }

  protected formatDateTime(value: string | Date): string {
    return new Intl.DateTimeFormat('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
      .format(new Date(value))
      .replace(':', 'h');
  }

  protected initials(name: string): string {
    return (
      name
        .split(' ')
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase())
        .join('') || 'JD'
    );
  }

  private loadDispute(): void {
    const reservationId = this.route.snapshot.paramMap.get('id');
    if (!reservationId) {
      this.errorMessage.set('Reservation introuvable.');
      this.isLoading.set(false);
      return;
    }

    this.isLoading.set(true);
    this.errorMessage.set(null);
    this.appointmentsService
      .getReservationDispute(reservationId)
      .pipe(
        catchError((error) => {
          this.errorMessage.set(getHttpErrorMessage(error, 'Impossible de charger la discussion du litige.'));
          return of(null);
        }),
        finalize(() => this.isLoading.set(false)),
      )
      .subscribe((dispute) => {
        this.dispute.set(dispute);
        this.thread.set(dispute ? this.buildThread(dispute) : []);
        if (dispute) {
          this.prepareConversation(dispute.reservationId);
        }
      });
  }

  private prepareConversation(reservationId: string): void {
    if (this.isPreparingConversation()) return;

    this.isPreparingConversation.set(true);
    this.messagesService
      .createConversation({ reservationId })
      .pipe(finalize(() => this.isPreparingConversation.set(false)))
      .subscribe({
        next: (conversation) => {
          this.conversationId.set(conversation.id);
          this.messagesRealtime.joinConversation(conversation.id);
        },
        error: (error) => {
          this.errorMessage.set(getHttpErrorMessage(error, 'Impossible d ouvrir le canal temps reel du litige.'));
        },
      });
  }

  private startRealtime(): void {
    if (!this.authSession.hasAuthenticatedSession()) return;

    this.messagesRealtime.connect();
    this.realtimeSubscription.add(
      this.messagesRealtime.messageCreated$.subscribe((message) => {
        if (message.conversationId !== this.conversationId()) return;
        this.upsertThreadItem(this.mapRealtimeMessage(message));
      }),
    );
    this.realtimeSubscription.add(
      this.messagesRealtime.disputeMediationMessageCreated$.subscribe((message) => {
        if (message.conversationId !== this.conversationId()) return;
        this.upsertThreadItem(this.mapMediationRealtimeMessage(message));
      }),
    );
  }

  private buildThread(dispute: ReservationDisputeView): DisputeThreadItem[] {
    const conversationItems = dispute.reservation.messages
      .filter((message) => message.expediteur.role !== 'ADMIN')
      .map<DisputeThreadItem>((message) => ({
        id: message.id,
        authorId: message.expediteur.id,
        authorName: message.expediteur.nom,
        role: message.expediteur.id === dispute.client.id ? 'CLIENT' : 'PRESTATAIRE',
        content: message.contenu || 'Piece jointe',
        mediaUrl: message.urlMedia,
        createdAt: message.creeLe,
        source: 'CONVERSATION',
      }));

    const mediationItems = dispute.reservation.mediationMessages
      .filter((message) => this.canViewMediationMessage(dispute, message.destinataire))
      .map<DisputeThreadItem>((message) => ({
        id: message.id,
        authorId: message.expediteurAdmin.id,
        authorName: 'Administration Jokko',
        role: 'ADMIN',
        content: message.contenu,
        mediaUrl: null,
        createdAt: message.creeLe,
        source: 'MEDIATION',
      }));

    return [...conversationItems, ...mediationItems].sort(
      (first, second) => new Date(first.createdAt).getTime() - new Date(second.createdAt).getTime(),
    );
  }

  private mapRealtimeMessage(message: ConversationMessage): DisputeThreadItem {
    const dispute = this.dispute();
    const role: DisputeThreadRole =
      message.sender.id === dispute?.client.id
        ? 'CLIENT'
        : message.sender.id === dispute?.professional.userId
          ? 'PRESTATAIRE'
          : 'ADMIN';

    return {
      id: message.id,
      authorId: message.sender.id,
      authorName: role === 'ADMIN' ? 'Administration Jokko' : message.sender.name,
      role,
      content: message.content || 'Piece jointe',
      mediaUrl: message.mediaUrl,
      createdAt: message.createdAt,
      source: 'CONVERSATION',
    };
  }

  private mapMediationRealtimeMessage(message: DisputeMediationRealtimeMessage): DisputeThreadItem {
    return {
      id: message.id,
      authorId: message.authorId,
      authorName: 'Administration Jokko',
      role: 'ADMIN',
      content: message.content,
      mediaUrl: null,
      createdAt: message.createdAt,
      source: 'MEDIATION',
    };
  }

  private canViewMediationMessage(
    dispute: ReservationDisputeView,
    recipient: 'CLIENT' | 'PRESTATAIRE' | 'TOUS',
  ): boolean {
    if (recipient === 'TOUS') return true;

    const currentUser = this.currentUser();
    if (!currentUser) return false;
    if (currentUser.role === 'ADMIN') return true;
    if (recipient === 'CLIENT') return currentUser.id === dispute.client.id;
    return currentUser.id === dispute.professional.userId;
  }

  private upsertThreadItem(item: DisputeThreadItem): void {
    this.thread.update((items) => {
      if (items.some((current) => current.id === item.id)) {
        return items;
      }

      return [...items, item].sort(
        (first, second) => new Date(first.createdAt).getTime() - new Date(second.createdAt).getTime(),
      );
    });
  }
}
