import { isPlatformBrowser } from '@angular/common';
import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { Observable, Subject } from 'rxjs';
import { io, Socket } from 'socket.io-client';
import { environment } from '../../../../environments/environment';
import { AuthSessionService } from '../../../core/auth/auth-session.service';
import type { UserNotificationView } from '../../../core/notifications/notifications.service';
import { ConversationMessage } from '../domain/models/messages.models';

export interface DisputeMediationRealtimeMessage {
  id: string;
  conversationId: string;
  authorId: string;
  authorName: string;
  recipient: 'CLIENT' | 'PRESTATAIRE' | 'TOUS';
  content: string;
  createdAt: string | Date;
}

@Injectable({
  providedIn: 'root',
})
export class MessagesRealtimeService {
  private readonly authSession = inject(AuthSessionService);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly pharmacyOrderChanged = new Subject<string>();
  readonly pharmacyOrderChanged$ = this.pharmacyOrderChanged.asObservable();
  private readonly connectedSubject = new Subject<void>();
  readonly connected$ = this.connectedSubject.asObservable();
  private readonly messageCreatedSubject = new Subject<ConversationMessage>();
  private readonly disputeMediationMessageCreatedSubject =
    new Subject<DisputeMediationRealtimeMessage>();
  private readonly notificationCreatedSubject = new Subject<UserNotificationView>();
  private readonly deliveryOfferResolvedSubject = new Subject<{
    orderId?: string;
    notificationId?: string;
  }>();
  readonly deliveryOfferResolved$ = this.deliveryOfferResolvedSubject.asObservable();
  private readonly joinedConversationIds = new Set<string>();
  private socket: Socket | null = null;

  readonly messageCreated$: Observable<ConversationMessage> =
    this.messageCreatedSubject.asObservable();
  readonly disputeMediationMessageCreated$: Observable<DisputeMediationRealtimeMessage> =
    this.disputeMediationMessageCreatedSubject.asObservable();
  readonly notificationCreated$: Observable<UserNotificationView> =
    this.notificationCreatedSubject.asObservable();

  connect(): void {
    if (!isPlatformBrowser(this.platformId) || this.socket) {
      return;
    }

    const token = this.authSession.getAccessToken();
    if (!token) {
      return;
    }

    this.socket = io(this.resolveSocketUrl(), {
      auth: { token },
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 5000,
    });

    this.socket.io.on('reconnect_attempt', () => {
      const currentToken = this.authSession.getAccessToken();
      if (!currentToken) { this.disconnect(); return; }
      if (this.socket) this.socket.auth = { token: currentToken };
    });
    this.socket.on('connect', () => {
      this.connectedSubject.next();
      for (const conversationId of this.joinedConversationIds) {
        this.socket?.emit('conversation.join', { conversationId });
      }
    });

    this.socket.on('conversation.message.created', (message: ConversationMessage) => {
      this.messageCreatedSubject.next(message);
    });

    this.socket.on(
      'dispute.mediation.message.created',
      (message: DisputeMediationRealtimeMessage) => {
        this.disputeMediationMessageCreatedSubject.next(message);
      },
    );
    this.socket.on(
      'delivery-offer.resolved',
      (event: { orderId?: string; notificationId?: string }) =>
        this.deliveryOfferResolvedSubject.next(event),
    );
    this.socket.on('pharmacy-order.updated', (event: { pharmacyOrderId?: string }) => {
      if (event?.pharmacyOrderId) this.pharmacyOrderChanged.next(event.pharmacyOrderId);
    });
    this.socket.on('notification.created', (notification: UserNotificationView) => {
      this.notificationCreatedSubject.next(notification);
    });
  }

  joinConversation(conversationId: string | null): void {
    if (!conversationId) {
      return;
    }

    this.connect();
    this.joinedConversationIds.add(conversationId);
    if (this.socket?.connected) {
      this.socket.emit('conversation.join', { conversationId });
    }
  }

  disconnect(): void {
    this.socket?.disconnect();
    this.socket = null;
    this.joinedConversationIds.clear();
  }

  private resolveSocketUrl(): string {
    try {
      return `${new URL(environment.apiUrl).origin}/socket`;
    } catch {
      return environment.apiUrl.replace(/\/api\/v1\/?$/, '/socket');
    }
  }
}
