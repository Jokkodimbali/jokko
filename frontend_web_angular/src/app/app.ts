import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { AppFeedbackService } from './core/feedback/app-feedback.service';
import { InlineFormValidationService } from './core/forms/inline-form-validation.service';
import { SessionPresenceService } from './core/presence/session-presence.service';
import { CallOverlayComponent } from './features/calls/presentation/call-overlay.component';

@Component({
  selector: 'app-root',
  imports: [CommonModule, RouterOutlet, LucideAngularModule, CallOverlayComponent],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  private readonly feedback = inject(AppFeedbackService);
  private readonly inlineFormValidation = inject(InlineFormValidationService);
  private readonly sessionPresence = inject(SessionPresenceService);

  protected readonly feedbackMessage = this.feedback.message;

  constructor() {
    this.inlineFormValidation.install();
  }
}
