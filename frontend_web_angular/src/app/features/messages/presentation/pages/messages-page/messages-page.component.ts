import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { AuthSessionService } from '../../../../../core/auth/auth-session.service';
import { AppFooterComponent } from '../../../../../shared/ui/app-footer/app-footer.component';
import { AppNavbarComponent } from '../../../../../shared/ui/app-navbar/app-navbar.component';
import { MessagesService } from '../../../data-access/messages.service';
import { Conversation, ConversationMessage } from '../../../domain/models/messages.models';

@Component({
  selector: 'app-messages-page',
  standalone: true,
  imports: [CommonModule, RouterLink, LucideAngularModule, AppFooterComponent, AppNavbarComponent],
  templateUrl: './messages-page.component.html',
  styleUrl: './messages-page.component.scss',
})
export class MessagesPageComponent implements OnInit {
  private readonly messagesService = inject(MessagesService);
  private readonly authSession = inject(AuthSessionService);

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

  ngOnInit(): void {
    this.loadConversations();
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

  private loadConversations(): void {
    this.isLoadingConversations.set(true);
    this.errorMessage.set(null);

    if (!this.currentUser()) {
      this.isLoadingConversations.set(false);
      return;
    }

    this.messagesService.listConversations().subscribe({
      next: (conversations) => {
        this.conversations.set(conversations);
        const selectedId = conversations[0]?.id ?? null;
        this.selectedConversationId.set(selectedId);
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
}
