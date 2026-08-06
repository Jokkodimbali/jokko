import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthSessionService } from '../../../core/auth/auth-session.service';
import { AppFeedbackService } from '../../../core/feedback/app-feedback.service';
import { MessagesService } from './messages.service';

export interface ProfessionalMessagingTarget {
  professionalProfileId: string;
  professionalUserId?: string;
  providerName: string;
  serviceId?: string;
}

@Injectable({ providedIn: 'root' })
export class ProfessionalMessagingNavigationService {
  private readonly authSession = inject(AuthSessionService);
  private readonly feedback = inject(AppFeedbackService);
  private readonly messages = inject(MessagesService);
  private readonly router = inject(Router);

  open(target: ProfessionalMessagingTarget): void {
    const directQuery = {
      ...(target.professionalUserId
        ? { professionalUserId: target.professionalUserId }
        : { professionalId: target.professionalProfileId }),
      providerName: target.providerName,
      ...(target.serviceId ? { serviceId: target.serviceId } : {}),
    };

    if (!this.authSession.hasAuthenticatedSession()) {
      void this.router.navigate(['/messages'], { queryParams: directQuery });
      return;
    }

    this.messages
      .createConversation({
        ...(target.professionalUserId
          ? { professionalUserId: target.professionalUserId }
          : { professionalProfileId: target.professionalProfileId }),
      })
      .subscribe({
        next: (conversation) => {
          void this.router.navigate(['/messages'], {
            queryParams: { conversationId: conversation.id },
          });
        },
        error: () =>
          this.feedback.error("Impossible d'ouvrir la discussion avec ce professionnel."),
      });
  }
}
