import { CommonModule } from '@angular/common';
import { Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { FavoriteItem } from '../../../../core/favorites/favorites.service';
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
  protected readonly totalFavorites = computed(() => this.favorites().length);
  protected readonly reviewedFavorites = computed(() =>
    this.favorites().filter((favorite) => favorite.totalReviews > 0).length,
  );
  protected readonly averageRating = computed(() => {
    const rated = this.favorites().filter((favorite) => favorite.totalReviews > 0);
    if (rated.length === 0) return 0;

    const total = rated.reduce((sum, favorite) => sum + favorite.rating, 0);
    return Math.round((total / rated.length) * 10) / 10;
  });

  constructor() {
    if (!this.authSession.hasAuthenticatedSession()) {
      return;
    }

    this.favoritesService.list().subscribe({
      error: () => {
      },
    });
  }

  protected removeFavorite(professionalId: string): void {
    if (!this.authSession.hasAuthenticatedSession()) {
      return;
    }

    this.favoritesService.remove(professionalId).subscribe({
      error: () => {
      },
    });
  }

  protected detailRoute(favorite: FavoriteItem): string[] {
    const category = `${favorite.service?.categoryName ?? ''} ${favorite.subtitle ?? ''}`
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();

    return category.includes('medecin') || category.includes('sante')
      ? ['/medecine', favorite.professionalId]
      : ['/services', favorite.professionalId];
  }

  protected formatAmount(value: number | null | undefined): string {
    if (!Number.isFinite(value) || !value) return 'Tarif non renseigne';

    return `${new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 }).format(value)} FCFA`;
  }
}
