import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { AppFeedbackService } from './core/feedback/app-feedback.service';

@Component({
  selector: 'app-root',
  imports: [CommonModule, RouterOutlet, LucideAngularModule],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  private readonly feedback = inject(AppFeedbackService);

  protected readonly title = signal('frontend_web_angular');
  protected readonly feedbackMessage = this.feedback.message;
  protected readonly feedbackTitle = computed(() => {
    const type = this.feedbackMessage()?.type;
    if (type === 'error') return 'Action impossible';
    if (type === 'info') return 'Information';
    return 'Operation reussie';
  });
  protected readonly feedbackIcon = computed(() => {
    const type = this.feedbackMessage()?.type;
    if (type === 'error') return 'triangle-alert';
    if (type === 'info') return 'info';
    return 'check';
  });
}
