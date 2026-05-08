import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { AuthSessionService } from '../../../../core/auth/auth-session.service';
import { FavoritesService } from '../../../../core/favorites/favorites.service';
import { AccountShellComponent } from '../../../../shared/ui/account-shell/account-shell.component';

@Component({
  selector: 'app-favorites-page',
  standalone: true,
  imports: [CommonModule, RouterLink, LucideAngularModule, AccountShellComponent],
  templateUrl: './favorites-page.component.html',
  styleUrl: './favorites-page.component.scss',
})
export class FavoritesPageComponent {
  private readonly favoritesService = inject(FavoritesService);
  private readonly authSession = inject(AuthSessionService);

  protected readonly favorites = this.favoritesService.favorites;
  protected readonly currentUser = this.authSession.currentUser;

  constructor() {
    if (!this.currentUser()) {
      return;
    }

    this.favoritesService.list().subscribe({
      error: () => {
      },
    });
  }

  protected removeFavorite(professionalId: string): void {
    if (!this.currentUser()) {
      return;
    }

    this.favoritesService.remove(professionalId).subscribe({
      error: () => {
      },
    });
  }
}
