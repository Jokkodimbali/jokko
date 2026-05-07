import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
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

  protected readonly favorites = this.favoritesService.favorites;

  constructor() {
    this.favoritesService.list().subscribe({
      error: () => {
        // La page affiche l'etat vide quand la session n'est pas active.
      },
    });
  }

  protected removeFavorite(professionalId: string): void {
    this.favoritesService.remove(professionalId).subscribe({
      error: () => {
        // Le cache local reste intact si l'API refuse la suppression.
      },
    });
  }
}
