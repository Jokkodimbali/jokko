import { Component, computed, inject, signal } from '@angular/core';
import { AuthSessionService } from '../../../core/auth/auth-session.service';
import { professionalHomeRoute } from '../../../core/auth/professional-space-role.utils';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-footer',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './app-footer.component.html',
  styleUrl: './app-footer.component.scss',
})
export class AppFooterComponent {
  private readonly authSession = inject(AuthSessionService);
  protected readonly isProfessional = computed(() => !!professionalHomeRoute(this.authSession.currentUser()?.role));
  protected readonly homeRoute = computed(() => professionalHomeRoute(this.authSession.currentUser()?.role) ?? '/services');
  protected readonly newsletterMessage = signal<string | null>(null);

  protected subscribeNewsletter(event: Event, email: string): void {
    event.preventDefault();

    if (!email.trim()) {
      this.newsletterMessage.set('Entrez votre email pour recevoir les nouveautes Jokko.');
      return;
    }

    this.newsletterMessage.set('Merci, votre inscription est prise en compte.');
  }
}
