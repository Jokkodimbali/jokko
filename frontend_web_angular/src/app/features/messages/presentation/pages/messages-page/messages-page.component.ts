import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { AuthSessionService } from '../../../../../core/auth/auth-session.service';
import { AppFooterComponent } from '../../../../../shared/ui/app-footer/app-footer.component';
import { AppNavbarComponent } from '../../../../../shared/ui/app-navbar/app-navbar.component';
import {
  NegotiationView,
  ServiceProposalService,
} from '../../../../services/data-access/service-proposal.service';
import { MessagesService } from '../../../data-access/messages.service';
import { Conversation, ConversationMessage } from '../../../domain/models/messages.models';

interface PendingProposal {
  negotiationId: string | null;
  conversationId: string | null;
  professionalId: string | null;
  providerName: string;
  serviceName: string;
  amount: number;
  status: string | null;
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
  private readonly authSession = inject(AuthSessionService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected readonly currentUser = this.authSession.currentUser;
  protected readonly conversations = signal<Conversation[]>([]);
  protected readonly messages = signal<ConversationMessage[]>([]);
  protected readonly selectedConversationId = signal<string | null>(null);
  protected readonly search = signal('');
  protected readonly draft = signal('');
  protected readonly isLoadingConversations = signal(true);
  protected readonly isLoadingMessages = signal(false);
  protected readonly isSending = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly pendingProposal = signal<PendingProposal | null>(null);
  protected readonly priceProposals = signal<NegotiationView[]>([]);
  private proposalStatusRefreshId: ReturnType<typeof setInterval> | null = null;

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

  ngOnInit(): void {
    this.readPendingProposalFromQuery();
    this.refreshPendingProposalStatus();
    this.startPendingProposalStatusRefresh();
    this.loadConversations();
  }

  ngOnDestroy(): void {
    if (this.proposalStatusRefreshId) {
      clearInterval(this.proposalStatusRefreshId);
    }
  }

  protected selectConversation(conversationId: string): void {
    if (this.selectedConversationId() === conversationId) {
      return;
    }

    this.selectedConversationId.set(conversationId);
    this.loadMessages(conversationId);
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
        this.messages.update((items) => [...items, message]);
        this.draft.set('');
        this.isSending.set(false);
        this.refreshConversationsSilently();
      },
      error: () => {
        this.errorMessage.set("Impossible d'envoyer le message pour le moment.");
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

  protected payAcceptedProposal(): void {
    this.router.navigate(['/appointments']);
  }

  protected cancelAcceptedProposal(): void {
    this.pendingProposal.set(null);
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
        const selectedId =
          this.findProposalConversation(conversations)?.id ?? conversations[0]?.id ?? null;
        this.selectedConversationId.set(selectedId);
        this.loadPriceProposals();
        this.isLoadingConversations.set(false);

        if (selectedId) {
          this.loadMessages(selectedId);
        }
      },
      error: () => {
        this.errorMessage.set('Impossible de charger vos conversations pour le moment.');
        this.isLoadingConversations.set(false);
      },
    });
  }

  private loadMessages(conversationId: string): void {
    this.isLoadingMessages.set(true);

    this.messagesService.listMessages(conversationId).subscribe({
      next: (messages) => {
        this.messages.set(messages);
        this.isLoadingMessages.set(false);
      },
      error: () => {
        this.errorMessage.set('Impossible de charger cette conversation.');
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

    this.proposalService.listMyPriceProposals().subscribe({
      next: (proposals) => {
        this.priceProposals.set(proposals.filter((proposal) => this.isVisibleProposalStatus(proposal.statut)));
      },
    });
  }

  private refreshPendingProposalStatus(): void {
    const proposal = this.pendingProposal();

    if (!proposal?.negotiationId || !this.authSession.hasAuthenticatedSession()) {
      return;
    }

    this.proposalService.listMyPriceProposals().subscribe({
      next: (proposals) => {
        const currentProposal = proposals.find((item) => item.id === proposal.negotiationId);
        if (!currentProposal) {
          return;
        }

        this.pendingProposal.set({
          ...proposal,
          amount: currentProposal.montantCourant || proposal.amount,
          status: currentProposal.statut,
        });
        this.priceProposals.update((items) => {
          const others = items.filter((item) => item.id !== currentProposal.id);
          return this.isVisibleProposalStatus(currentProposal.statut)
            ? [currentProposal, ...others]
            : others;
        });

        if (currentProposal.statut === 'ACCEPTEE' && this.proposalStatusRefreshId) {
          clearInterval(this.proposalStatusRefreshId);
          this.proposalStatusRefreshId = null;
        }
      },
    });
  }

  private startPendingProposalStatusRefresh(): void {
    const proposal = this.pendingProposal();

    if (!proposal?.negotiationId || this.proposalStatusRefreshId) {
      return;
    }

    this.proposalStatusRefreshId = setInterval(() => {
      this.refreshPendingProposalStatus();
    }, 5000);
  }

  private readPendingProposalFromQuery(): void {
    const query = this.route.snapshot.queryParamMap;
    const rawAmount = Number(query.get('amount'));
    const professionalId = query.get('professionalId');

    if (!professionalId && !Number.isFinite(rawAmount)) {
      return;
    }

    this.pendingProposal.set({
      negotiationId: query.get('negotiationId'),
      conversationId: query.get('conversationId'),
      professionalId,
      providerName: query.get('providerName') || 'le prestataire',
      serviceName: query.get('serviceName') || 'service',
      amount: Number.isFinite(rawAmount) && rawAmount > 0 ? rawAmount : 0,
      status: query.get('status'),
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
    const professionalId = conversation.counterpart.professionalProfileId;
    const proposal = this.priceProposals().find(
      (item) => professionalId && item.professionnelId === professionalId,
    );

    if (!proposal) {
      return null;
    }

    return {
      negotiationId: proposal.id,
      conversationId: conversation.id,
      professionalId: proposal.professionnelId,
      providerName: conversation.counterpart.name,
      serviceName: 'service',
      amount: proposal.montantCourant || proposal.montantInitial,
      status: proposal.statut,
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
}
