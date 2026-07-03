import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
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

  protected readonly feedbackMessage = this.feedback.message;
}
