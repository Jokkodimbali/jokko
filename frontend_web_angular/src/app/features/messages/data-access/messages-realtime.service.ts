import { isPlatformBrowser } from '@angular/common';
import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import { io, Socket } from 'socket.io-client';
import { environment } from '../../../../environments/environment';
import { AuthSessionService } from '../../../core/auth/auth-session.service';
import { ConversationMessage } from '../domain/models/messages.models';

@Injectable({
  providedIn: 'root',
})
export class MessagesRealtimeService {
  private readonly authSession = inject(AuthSessionService);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly messageCreatedSubject = new Subject<ConversationMessage>();
  private socket: Socket | null = null;

  readonly messageCreated$: Observable<ConversationMessage> =
    this.messageCreatedSubject.asObservable();

  connect(): void {
    if (!isPlatformBrowser(this.platformId) || this.socket?.connected) {
      return;
    }

    const token = this.authSession.getAccessToken();
    if (!token) {
      return;
    }

    this.socket = io(this.resolveSocketUrl(), {
      auth: { token },
      transports: ['websocket', 'polling'],
    });

    this.socket.on('conversation.message.created', (message: ConversationMessage) => {
      this.messageCreatedSubject.next(message);
    });
  }

  joinConversation(conversationId: string | null): void {
    if (!conversationId) {
      return;
    }

    this.connect();
    this.socket?.emit('conversation.join', { conversationId });
  }

  disconnect(): void {
    this.socket?.disconnect();
    this.socket = null;
  }

  private resolveSocketUrl(): string {
    try {
      return `${new URL(environment.apiUrl).origin}/socket`;
    } catch {
      return environment.apiUrl.replace(/\/api\/v1\/?$/, '/socket');
    }
  }
}
