import { Component, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-footer',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './app-footer.component.html',
  styleUrl: './app-footer.component.scss',
})
export class AppFooterComponent {
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
