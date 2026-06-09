import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { Subscription } from 'rxjs';
import { AuthSessionService } from '../../../../../core/auth/auth-session.service';
import { AppFeedbackService } from '../../../../../core/feedback/app-feedback.service';
import { getHttpErrorMessage } from '../../../../../core/http/api-response.utils';
import { AppFooterComponent } from '../../../../../shared/ui/app-footer/app-footer.component';
import { AppNavbarComponent } from '../../../../../shared/ui/app-navbar/app-navbar.component';
import { AppointmentsService } from '../../../../appointments/data-access/appointments.service';
import { AppointmentView } from '../../../../appointments/domain/appointments.models';
import {
  NegotiationView,
  ServiceProposalService,
} from '../../../../services/data-access/service-proposal.service';
import { MessagesService } from '../../../data-access/messages.service';
import { MessagesRealtimeService } from '../../../data-access/messages-realtime.service';
import { Conversation, ConversationMessage } from '../../../domain/models/messages.models';

interface PendingProposal {
  negotiationId: string | null;
  conversationId: string | null;
  professionalId: string | null;
  providerName: string;
  serviceName: string;
  amount: number;
  status: string | null;
  reservationId: string | null;
  appointmentDate: string | null;
  address: string | null;
  durationMinutes: number;
  proposalMessage: string | null;
}

interface ReservationPaymentDraft {
  negotiationId: string;
  appointmentDate: string;
  address: string;
  durationMinutes: number;
}

@Component({
  selector: 'app-messages-page',
  standalone: true,
  imports: [CommonModule, RouterLink, LucideAngularModule, AppFooterComponent, AppNavbarComponent],
  templateUrl: './messages-page.component.html',
  styleUrl: './messages-page.component.scss',
})
export class MessagesPageComponent implements OnInit, OnDestroy {
  private readonly messagesService = inject(MessagesService);
  private readonly proposalService = inject(ServiceProposalService);
  private readonly appointmentsService = inject(AppointmentsService);
  private readonly authSession = inject(AuthSessionService);
  private readonly messagesRealtime = inject(MessagesRealtimeService);
  private readonly feedback = inject(AppFeedbackService);
  private readonly route = inject(ActivatedRoute);

  protected readonly currentUser = this.authSession.currentUser;
  protected readonly conversations = signal<Conversation[]>([]);
  protected readonly messages = signal<ConversationMessage[]>([]);
  protected readonly selectedConversationId = signal<string | null>(null);
  protected readonly search = signal('');
  protected readonly draft = signal('');
  protected readonly isLoadingConversations = signal(true);
  protected readonly isLoadingMessages = signal(false);
  protected readonly isSending = signal(false);
  protected readonly isPreparingPayment = signal(false);
  protected readonly isUpdatingProposal = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly pendingProposal = signal<PendingProposal | null>(null);
  protected readonly priceProposals = signal<NegotiationView[]>([]);
  protected readonly appointmentPreview = signal<AppointmentView | null>(null);
  protected readonly failedAvatarUrls = signal<Set<string>>(new Set());
  private readonly requestedConversationId = signal<string | null>(null);
  private proposalStatusRefreshId: ReturnType<typeof setInterval> | null = null;
  private realtimeMessageSubscription: Subscription | null = null;

  protected readonly selectedConversation = computed(() =>
    this.conversations().find((conversation) => conversation.id === this.selectedConversationId()) ?? null,
  );

  protected readonly filteredConversations = computed(() => {
    const query = this.search().trim().toLowerCase();

    if (!query) {
      return this.conversations();
    }

    return this.conversations().filter((conversation) => {
      const lastMessage = conversation.lastMessage?.content ?? '';
      return (
        conversation.counterpart.name.toLowerCase().includes(query) ||
        lastMessage.toLowerCase().includes(query)
      );
    });
  });

  protected readonly visibleProposal = computed<PendingProposal | null>(() => {
    const proposal = this.pendingProposal();
    const conversation = this.selectedConversation();
    const conversationProposal = conversation ? this.proposalFromConversation(conversation) : null;

    if (conversationProposal) {
      return proposal && this.isProposalForConversation(proposal, conversation)
        ? {
            ...conversationProposal,
            appointmentDate: proposal.appointmentDate,
            address: proposal.address,
            durationMinutes: proposal.durationMinutes,
            serviceName: proposal.serviceName || conversationProposal.serviceName,
            proposalMessage: proposal.proposalMessage || conversationProposal.proposalMessage,
          }
        : conversationProposal;
    }

    if (proposal && this.isProposalForConversation(proposal, conversation)) {
      return proposal;
    }

    if (!conversation) {
      return proposal;
    }

    return this.proposalFromConversation(conversation);
  });

  protected readonly isProposalAccepted = computed(() => {
    const status = this.visibleProposal()?.status;
    return status === 'ACCEPTEE' || status === 'CONVERTIE_EN_RESERVATION';
  });

  protected readonly canRespondToProposal = computed(() => {
    const proposal = this.visibleProposal();
    return (
      this.isProfessionalRole() &&
      proposal?.status === 'EN_ATTENTE_PRESTATAIRE' &&
      Boolean(proposal.negotiationId)
    );
  });

  protected readonly canPayAcceptedProposal = computed(
    () => this.currentUser()?.role === 'CLIENT' && this.isProposalAccepted(),
  );

  ngOnInit(): void {
    this.readPendingProposalFromQuery();
    this.startRealtimeMessaging();
    this.startProposalRefresh();
    this.loadConversations();
  }

  ngOnDestroy(): void {
    if (this.proposalStatusRefreshId) {
      clearInterval(this.proposalStatusRefreshId);
    }
    this.realtimeMessageSubscription?.unsubscribe();
    this.messagesRealtime.disconnect();
  }

  protected selectConversation(conversationId: string): void {
    if (this.selectedConversationId() === conversationId) {
      return;
    }

    this.selectedConversationId.set(conversationId);
    this.markConversationAsReadLocally(conversationId);
    this.messagesRealtime.joinConversation(conversationId);
    this.appointmentPreview.set(null);
    this.loadMessages(conversationId);
    setTimeout(() => this.loadAppointmentPreviewForVisibleProposal(), 0);
  }

  protected updateSearch(value: string): void {
    this.search.set(value);
  }

  protected updateDraft(value: string): void {
    this.draft.set(value);
  }

  protected sendMessage(): void {
    const conversation = this.selectedConversation();
    const content = this.draft().trim();

    if (!conversation || !content || this.isSending()) {
      return;
    }

    this.isSending.set(true);
    this.messagesService.sendMessage(conversation.id, content).subscribe({
      next: (message) => {
        this.upsertMessage(message);
        this.draft.set('');
        this.isSending.set(false);
        this.refreshConversationsSilently();
      },
      error: () => {
        const message = "Impossible d'envoyer le message pour le moment.";
        this.errorMessage.set(message);
        this.feedback.error(message);
        this.isSending.set(false);
      },
    });
  }

  protected isOwnMessage(message: ConversationMessage): boolean {
    return message.senderId === this.currentUser()?.id;
  }

  protected initials(name: string): string {
    return name
      .split(' ')
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join('')
      .toUpperCase();
  }

  protected visibleAvatarUrl(url: string | null | undefined): string | null {
    const normalizedUrl = url?.trim();
    if (!normalizedUrl || this.failedAvatarUrls().has(normalizedUrl)) {
      return null;
    }

    return normalizedUrl;
  }

  protected handleAvatarError(url: string | null | undefined): void {
    const normalizedUrl = url?.trim();
    if (!normalizedUrl) {
      return;
    }

    this.failedAvatarUrls.update((urls) => {
      const next = new Set(urls);
      next.add(normalizedUrl);
      return next;
    });
  }

  protected conversationPreview(conversation: Conversation): string {
    return conversation.lastMessage?.content || conversation.lastMessage?.mediaUrl || 'Conversation ouverte';
  }

  protected formatDate(value: string | null): string {
    if (!value) {
      return '';
    }

    return new Intl.DateTimeFormat('fr-FR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(new Date(value));
  }

  protected formatTime(value: string | null): string {
    if (!value) {
      return '';
    }

    return new Intl.DateTimeFormat('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(value));
  }

  protected formatAmount(value: number): string {
    return new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(value || 0);
  }

  protected formatUnreadCount(value: number): string {
    return value > 99 ? '99+' : value.toString();
  }

  protected payAcceptedProposal(): void {
    const proposal = this.visibleProposal();

    if (!proposal || this.isPreparingPayment()) {
      return;
    }

    if (proposal.reservationId) {
      this.loadAppointmentPreview(proposal.reservationId);
      return;
    }

    const draft = this.validateReservationPaymentDraft(proposal);
    if (!draft) {
      return;
    }

    this.createReservationCardFromProposal(proposal, draft);
  }

  private createReservationCardFromProposal(
    proposal: PendingProposal,
    draft: ReservationPaymentDraft,
  ): void {
    this.isPreparingPayment.set(true);
    this.errorMessage.set(null);
    this.proposalService
      .createReservationFromNegotiation({
        negotiationId: draft.negotiationId,
        dateHeure: draft.appointmentDate,
        adresseClient: draft.address,
        dureeMinutes: draft.durationMinutes,
        notes: `Reservation creee apres acceptation du prix propose: ${this.formatAmount(proposal.amount)} FCFA.`,
      })
      .subscribe({
        next: (reservation) => {
          this.isPreparingPayment.set(false);
          this.pendingProposal.update((current) =>
            current?.negotiationId === proposal.negotiationId
              ? {
                  ...current,
                  reservationId: reservation.id,
                  status: 'CONVERTIE_EN_RESERVATION',
                }
              : current,
          );
          this.loadAppointmentPreview(reservation.id);
          this.loadPriceProposals();
          this.refreshConversationsSilently();
        },
        error: (error) => {
          this.errorMessage.set(
            getHttpErrorMessage(error, 'Impossible de creer la reservation avant paiement.'),
          );
          this.isPreparingPayment.set(false);
        },
      });
  }

  protected cancelAcceptedProposal(): void {
    this.pendingProposal.set(null);
  }

  protected acceptProposal(): void {
    const proposal = this.visibleProposal();
    if (!proposal || this.isUpdatingProposal()) {
      return;
    }

    if (!this.validateProposalResponse(proposal, 'accept')) {
      return;
    }
    const negotiationId = proposal.negotiationId;
    if (!negotiationId) {
      return;
    }

    this.isUpdatingProposal.set(true);
    this.errorMessage.set(null);

    this.proposalService.acceptPriceProposal(negotiationId).subscribe({
      next: (updatedProposal) => {
        this.upsertProposal(updatedProposal);
        this.pendingProposal.update((current) =>
          current?.negotiationId === updatedProposal.id
            ? {
                ...current,
                amount: updatedProposal.montantCourant,
                status: updatedProposal.statut,
                reservationId: updatedProposal.reservationId,
              }
            : current,
        );
        this.isUpdatingProposal.set(false);
        this.feedback.success('Proposition acceptee.');
      },
      error: () => {
        const message = "Impossible d'accepter cette proposition.";
        this.errorMessage.set(message);
        this.feedback.error(message);
        this.isUpdatingProposal.set(false);
      },
    });
  }

  protected rejectProposal(): void {
    const proposal = this.visibleProposal();
    if (!proposal || this.isUpdatingProposal()) {
      return;
    }

    if (!this.validateProposalResponse(proposal, 'reject')) {
      return;
    }
    const negotiationId = proposal.negotiationId;
    if (!negotiationId) {
      return;
    }

    this.isUpdatingProposal.set(true);
    this.errorMessage.set(null);

    this.proposalService.rejectPriceProposal(negotiationId, 'Proposition refusee par le prestataire.').subscribe({
      next: (updatedProposal) => {
        this.upsertProposal(updatedProposal);
        this.pendingProposal.update((current) =>
          current?.negotiationId === updatedProposal.id
            ? {
                ...current,
                amount: updatedProposal.montantCourant,
                status: updatedProposal.statut,
                reservationId: updatedProposal.reservationId,
              }
            : current,
        );
        this.isUpdatingProposal.set(false);
        this.feedback.success('Proposition refusee.');
      },
      error: () => {
        const message = 'Impossible de refuser cette proposition.';
        this.errorMessage.set(message);
        this.feedback.error(message);
        this.isUpdatingProposal.set(false);
      },
    });
  }

  private loadConversations(): void {
    this.isLoadingConversations.set(true);
    this.errorMessage.set(null);

    if (!this.authSession.hasAuthenticatedSession()) {
      this.isLoadingConversations.set(false);
      return;
    }

    this.messagesService.listConversations().subscribe({
      next: (conversations) => {
        this.conversations.set(conversations);
        const requestedConversationId = this.requestedConversationId();
        const selectedId =
          conversations.find((conversation) => conversation.id === requestedConversationId)?.id ??
          this.findProposalConversation(conversations)?.id ?? conversations[0]?.id ?? null;
        this.selectedConversationId.set(selectedId);
        this.loadPriceProposals();
        this.isLoadingConversations.set(false);

        if (selectedId) {
          this.messagesRealtime.joinConversation(selectedId);
          this.loadMessages(selectedId);
        }
      },
      error: () => {
        const message = 'Impossible de charger vos conversations pour le moment.';
        this.errorMessage.set(message);
        this.feedback.error(message);
        this.isLoadingConversations.set(false);
      },
    });
  }

  private loadMessages(conversationId: string): void {
    this.isLoadingMessages.set(true);

    this.messagesService.listMessages(conversationId).subscribe({
      next: (messages) => {
        this.messages.set(messages);
        this.markConversationAsReadLocally(conversationId);
        this.isLoadingMessages.set(false);
        this.refreshConversationsSilently();
      },
      error: () => {
        const message = 'Impossible de charger cette conversation.';
        this.errorMessage.set(message);
        this.feedback.error(message);
        this.isLoadingMessages.set(false);
      },
    });
  }

  private refreshConversationsSilently(): void {
    this.messagesService.listConversations().subscribe({
      next: (conversations) => this.conversations.set(conversations),
    });
  }

  private loadPriceProposals(): void {
    if (!this.authSession.hasAuthenticatedSession()) {
      return;
    }

    const scope = this.resolveNegotiationScope();
    if (!scope) {
      this.priceProposals.set([]);
      return;
    }

    this.proposalService.listMyPriceProposals(scope).subscribe({
      next: (proposals) => {
        this.priceProposals.set(proposals.filter((proposal) => this.isVisibleProposalStatus(proposal.statut)));
        this.loadAppointmentPreviewForVisibleProposal();
      },
      error: () => {
        this.priceProposals.set([]);
      },
    });
  }

  private refreshPendingProposalStatus(): void {
    const proposal = this.pendingProposal();

    if (!proposal?.negotiationId || !this.authSession.hasAuthenticatedSession()) {
      return;
    }

    const scope = this.resolveNegotiationScope();
    if (!scope) {
      return;
    }

    this.proposalService.listMyPriceProposals(scope).subscribe({
      next: (proposals) => {
        const currentProposal = proposals.find((item) => item.id === proposal.negotiationId);
        if (!currentProposal) {
          return;
        }

        this.pendingProposal.set({
          ...proposal,
          amount: currentProposal.montantCourant || proposal.amount,
          status: currentProposal.statut,
          reservationId: currentProposal.reservationId,
        });
        this.upsertProposal(currentProposal);
      },
      error: () => undefined,
    });
  }

  private startProposalRefresh(): void {
    if (!this.authSession.hasAuthenticatedSession() || this.proposalStatusRefreshId) {
      return;
    }

    this.proposalStatusRefreshId = setInterval(() => {
      this.refreshConversationsSilently();
      this.loadPriceProposals();
      const conversationId = this.selectedConversationId();
      if (conversationId) {
        this.refreshMessagesSilently(conversationId);
      }
      this.refreshPendingProposalStatus();
    }, 10000);
  }

  private readPendingProposalFromQuery(): void {
    const query = this.route.snapshot.queryParamMap;
    const rawAmount = Number(query.get('amount'));
    const professionalId = query.get('professionalId');
    const conversationId = query.get('conversationId');

    this.requestedConversationId.set(conversationId);

    if (!professionalId && !Number.isFinite(rawAmount)) {
      return;
    }

    this.pendingProposal.set({
      negotiationId: query.get('negotiationId'),
      conversationId,
      professionalId,
      providerName: query.get('providerName') || 'le prestataire',
      serviceName: query.get('serviceName') || 'service',
      amount: Number.isFinite(rawAmount) && rawAmount > 0 ? rawAmount : 0,
      status: query.get('status'),
      reservationId: query.get('reservationId'),
      appointmentDate: query.get('appointmentDate'),
      address: query.get('address'),
      durationMinutes: Number(query.get('durationMinutes')) || 60,
      proposalMessage: null,
    });
  }

  private findProposalConversation(conversations: Conversation[]): Conversation | null {
    const proposal = this.pendingProposal();

    if (!proposal) {
      return null;
    }

    return (
      conversations.find((conversation) => conversation.id === proposal.conversationId) ??
      conversations.find(
        (conversation) =>
          conversation.counterpart.professionalProfileId === proposal.professionalId ||
          conversation.counterpart.name === proposal.providerName,
      ) ?? null
    );
  }

  private isProposalForConversation(
    proposal: PendingProposal,
    conversation: Conversation | null,
  ): boolean {
    if (!conversation) {
      return true;
    }

    return (
      conversation.id === proposal.conversationId ||
      conversation.counterpart.professionalProfileId === proposal.professionalId ||
      conversation.counterpart.name === proposal.providerName
    );
  }

  private proposalFromConversation(conversation: Conversation): PendingProposal | null {
    const professionalId =
      conversation.professionalProfileId ?? conversation.counterpart.professionalProfileId;
    const clientId =
      this.isProfessionalRole()
        ? conversation.counterpart.userId
        : this.currentUser()?.id;
    const proposal = this.priceProposals().find(
      (item) =>
        professionalId &&
        item.professionnelId === professionalId &&
        (!clientId || item.clientId === clientId),
    );

    if (!proposal) {
      return null;
    }
    const details = this.extractProposalDetails(proposal.messageCourant);

    return {
      negotiationId: proposal.id,
      conversationId: conversation.id,
      professionalId: proposal.professionnelId,
      providerName:
        this.isProfessionalRole()
          ? 'vous'
          : conversation.counterpart.name,
      serviceName: details.serviceName ?? 'service',
      amount: proposal.montantCourant || proposal.montantInitial,
      status: proposal.statut,
      reservationId: proposal.reservationId,
      appointmentDate: proposal.dateHeureProposee ?? details.appointmentDate,
      address: proposal.adresseClientProposee ?? details.address,
      durationMinutes: proposal.dureeMinutesProposee ?? details.durationMinutes ?? 60,
      proposalMessage: proposal.messageCourant,
    };
  }

  private isVisibleProposalStatus(status: string): boolean {
    return (
      status === 'EN_ATTENTE_PRESTATAIRE' ||
      status === 'EN_ATTENTE_CLIENT' ||
      status === 'ACCEPTEE' ||
      status === 'CONVERTIE_EN_RESERVATION'
    );
  }

  private resolveNegotiationScope(): 'CLIENT' | 'PRESTATAIRE' | null {
    const role = this.authSession.getAuthenticatedRole();
    if (role === 'CLIENT') return 'CLIENT';
    if (role === 'PRESTATAIRE' || role === 'MEDECIN') return 'PRESTATAIRE';
    return null;
  }

  private upsertProposal(proposal: NegotiationView): void {
    this.priceProposals.update((items) => {
      const others = items.filter((item) => item.id !== proposal.id);
      return this.isVisibleProposalStatus(proposal.statut)
        ? [proposal, ...others]
        : others;
    });
  }

  private refreshMessagesSilently(conversationId: string): void {
    this.messagesService.listMessages(conversationId).subscribe({
      next: (messages) => this.messages.set(messages),
    });
  }

  private startRealtimeMessaging(): void {
    if (!this.authSession.hasAuthenticatedSession()) {
      return;
    }

    this.messagesRealtime.connect();
    this.realtimeMessageSubscription = this.messagesRealtime.messageCreated$.subscribe((message) => {
      const isSelectedConversation = message.conversationId === this.selectedConversationId();
      this.upsertConversationFromMessage(message, isSelectedConversation);

      if (!isSelectedConversation) {
        this.refreshConversationsSilently();
        return;
      }

      this.upsertMessage(message);
      this.messagesRealtime.joinConversation(message.conversationId);
      this.refreshConversationsSilently();
    });
  }

  private upsertMessage(message: ConversationMessage): void {
    this.messages.update((items) => {
      if (items.some((item) => item.id === message.id)) {
        return items;
      }

      return [...items, message];
    });
  }

  private upsertConversationFromMessage(message: ConversationMessage, isOpen: boolean): void {
    const currentUserId = this.currentUser()?.id;
    const shouldIncrementUnread = !isOpen && message.senderId !== currentUserId;

    this.conversations.update((items) => {
      const nextItems = items.map((conversation) => {
        if (conversation.id !== message.conversationId) {
          return conversation;
        }

        return {
          ...conversation,
          lastMessageAt: message.createdAt,
          unreadCount: shouldIncrementUnread ? conversation.unreadCount + 1 : conversation.unreadCount,
          lastMessage: {
            id: message.id,
            senderId: message.senderId,
            content: message.content,
            mediaUrl: message.mediaUrl,
            createdAt: message.createdAt,
          },
        };
      });

      return nextItems.sort((first, second) => {
        const firstDate = new Date(first.lastMessageAt || first.createdAt).getTime();
        const secondDate = new Date(second.lastMessageAt || second.createdAt).getTime();
        return secondDate - firstDate;
      });
    });
  }

  private markConversationAsReadLocally(conversationId: string): void {
    this.conversations.update((items) =>
      items.map((conversation) =>
        conversation.id === conversationId
          ? { ...conversation, unreadCount: 0 }
          : conversation,
      ),
    );
  }

  private loadAppointmentPreviewForVisibleProposal(): void {
    const proposal = this.visibleProposal();
    if (!proposal?.reservationId || this.currentUser()?.role !== 'CLIENT') {
      return;
    }

    if (this.appointmentPreview()?.id === proposal.reservationId) {
      return;
    }

    this.loadAppointmentPreview(proposal.reservationId);
  }

  private loadAppointmentPreview(reservationId: string): void {
    this.appointmentsService.getAppointmentById(reservationId).subscribe({
      next: (appointment) => this.appointmentPreview.set(appointment),
      error: () => {
        this.errorMessage.set('Impossible de charger le resume du rendez-vous.');
      },
    });
  }

  private extractProposalDetails(message: string | null): {
    appointmentDate: string | null;
    address: string | null;
    durationMinutes: number | null;
    serviceName: string | null;
  } {
    if (!message) {
      return {
        appointmentDate: null,
        address: null,
        durationMinutes: null,
        serviceName: null,
      };
    }

    const serviceMatch = message.match(/Service:\s*([^.]+)\./i);
    const dateMatch = message.match(/Date souhaitee:\s*([^.]+)\./i);
    const addressMatch = message.match(/Adresse:\s*([^.]+)\./i);
    const durationMatch = message.match(/Duree:\s*(\d{1,4})\s*minutes?\./i);
    const parsedDuration = durationMatch ? Number(durationMatch[1]) : null;
    const durationMinutes =
      typeof parsedDuration === 'number' &&
      Number.isInteger(parsedDuration) &&
      parsedDuration >= 15 &&
      parsedDuration <= 1440
        ? parsedDuration
        : null;

    return {
      appointmentDate: dateMatch ? this.parseProposalDate(dateMatch[1]) : null,
      address: addressMatch?.[1]?.trim() || null,
      durationMinutes,
      serviceName: serviceMatch?.[1]?.trim() || null,
    };
  }

  private resolveReservationDraft(proposal: PendingProposal): {
    appointmentDate: string | null;
    address: string | null;
    durationMinutes: number;
  } {
    const messageDetails = this.extractProposalDetails(proposal.proposalMessage || proposal.serviceName);

    return {
      appointmentDate: proposal.appointmentDate || messageDetails.appointmentDate,
      address: proposal.address || messageDetails.address,
      durationMinutes: proposal.durationMinutes || messageDetails.durationMinutes || 60,
    };
  }

  private parseProposalDate(value: string): string | null {
    const normalized = value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .toUpperCase();
    const match = normalized.match(
      /^(\d{1,2})\s+([A-Z]+)\s+(\d{4})(?:(?:\s+(?:A|À))?\s+(\d{1,2})[:H](\d{2}))?$/,
    );
    if (!match) {
      return null;
    }

    const months: Record<string, number> = {
      JANVIER: 0,
      FEVRIER: 1,
      MARS: 2,
      AVRIL: 3,
      MAI: 4,
      JUIN: 5,
      JUILLET: 6,
      AOUT: 7,
      SEPTEMBRE: 8,
      OCTOBRE: 9,
      NOVEMBRE: 10,
      DECEMBRE: 11,
    };
    const month = months[match[2]];
    if (month === undefined) {
      return null;
    }

    const hours = match[4] ? Number(match[4]) : 12;
    const minutes = match[5] ? Number(match[5]) : 0;
    if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
      return null;
    }

    const date = new Date(Date.UTC(Number(match[3]), month, Number(match[1]), hours, minutes, 0));
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }

  private validateProposalResponse(proposal: PendingProposal, action: 'accept' | 'reject'): boolean {
    if (!this.isProfessionalRole()) {
      this.errorMessage.set('Seul le prestataire peut valider ou refuser une proposition.');
      return false;
    }

    if (!proposal.negotiationId) {
      this.errorMessage.set('Impossible de traiter cette proposition: identifiant manquant.');
      return false;
    }

    if (proposal.status !== 'EN_ATTENTE_PRESTATAIRE') {
      this.errorMessage.set(
        action === 'accept'
          ? 'Cette proposition ne peut plus etre acceptee.'
          : 'Cette proposition ne peut plus etre refusee.',
      );
      return false;
    }

    if (!Number.isFinite(proposal.amount) || proposal.amount <= 0) {
      this.errorMessage.set('Impossible de traiter cette proposition: montant invalide.');
      return false;
    }

    return true;
  }

  private validateReservationPaymentDraft(
    proposal: PendingProposal,
  ): ReservationPaymentDraft | null {
    if (this.currentUser()?.role !== 'CLIENT') {
      this.errorMessage.set('Seul le client peut preparer le paiement de cette reservation.');
      return null;
    }

    if (proposal.status !== 'ACCEPTEE') {
      this.errorMessage.set('Le paiement est disponible seulement apres acceptation du prix.');
      return null;
    }

    if (!proposal.negotiationId) {
      this.errorMessage.set('Impossible de creer la reservation: proposition introuvable.');
      return null;
    }

    if (!Number.isFinite(proposal.amount) || proposal.amount <= 0) {
      this.errorMessage.set('Impossible de creer la reservation: montant invalide.');
      return null;
    }

    const draft = this.resolveReservationDraft(proposal);
    const appointmentDate = draft.appointmentDate;
    const scheduledAt = appointmentDate ? new Date(appointmentDate) : null;
    if (!appointmentDate || !scheduledAt || Number.isNaN(scheduledAt.getTime())) {
      this.errorMessage.set('Impossible de creer la reservation: date du rendez-vous manquante.');
      return null;
    }

    if (scheduledAt.getTime() <= Date.now()) {
      this.errorMessage.set('Impossible de creer la reservation: la date du rendez-vous est deja passee.');
      return null;
    }

    const address = draft.address?.trim().replace(/\s+/g, ' ') ?? '';
    if (address.length < 5 || address.length > 180) {
      this.errorMessage.set('Impossible de creer la reservation: adresse du rendez-vous invalide.');
      return null;
    }

    const durationMinutes = Math.trunc(Number(draft.durationMinutes));
    if (!Number.isInteger(durationMinutes) || durationMinutes < 15 || durationMinutes > 1440) {
      this.errorMessage.set('Impossible de creer la reservation: duree du rendez-vous invalide.');
      return null;
    }

    return {
      negotiationId: proposal.negotiationId,
      appointmentDate,
      address,
      durationMinutes,
    };
  }

  private isProfessionalRole(): boolean {
    const role = this.currentUser()?.role;
    return role === 'PRESTATAIRE' || role === 'MEDECIN';
  }
}
