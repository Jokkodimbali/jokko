import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class MessagesNavigationStateService {
  private readonly conversationByUser = new Map<string, string>();

  getLastConversationId(userId: string | null | undefined): string | null {
    return this.conversationByUser.get(this.userKey(userId)) ?? null;
  }

  rememberConversation(userId: string | null | undefined, conversationId: string): void {
    this.conversationByUser.set(this.userKey(userId), conversationId);
  }

  forgetConversation(userId: string | null | undefined): void {
    this.conversationByUser.delete(this.userKey(userId));
  }

  private userKey(userId: string | null | undefined): string {
    return userId || 'anonymous';
  }
}
