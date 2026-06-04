import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { LucideAngularModule } from 'lucide-angular';
import { FavoriteItem } from '../../../../core/favorites/favorites.service';
import { AuthSessionService } from '../../../../core/auth/auth-session.service';
import { AppFeedbackService } from '../../../../core/feedback/app-feedback.service';
import { FavoritesService } from '../../../../core/favorites/favorites.service';
import { AccountShellComponent } from '../../../../shared/ui/account-shell/account-shell.component';

@Component({
  selector: 'app-favorites-page',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, LucideAngularModule, AccountShellComponent],
  templateUrl: './favorites-page.component.html',
  styleUrl: './favorites-page.component.scss',
})
export class FavoritesPageComponent {
  private readonly favoritesService = inject(FavoritesService);
  private readonly authSession = inject(AuthSessionService);
  private readonly feedback = inject(AppFeedbackService);

  protected readonly favorites = this.favoritesService.favorites;
  protected readonly currentUser = this.authSession.currentUser;
  protected readonly selectedCategory = signal('Tous');
  protected readonly sortBy = signal<'recent' | 'rating' | 'name'>('recent');
  protected readonly availableOnly = signal(false);
  protected readonly isLoading = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  protected readonly totalFavorites = computed(() => this.favorites().length);
  protected readonly onlineFavorites = computed(() =>
    this.favorites().filter((favorite) => favorite.isOnline).length,
  );
  protected readonly availableFavorites = computed(() =>
    this.favorites().filter((favorite) => favorite.isAvailableToday).length,
  );
  protected readonly newFavorites = computed(() =>
    this.favorites().filter((favorite) => favorite.isNew).length,
  );
  protected readonly categories = computed(() => {
    const values = new Set(
      this.favorites()
        .map((favorite) => favorite.service?.categoryName || favorite.subtitle)
        .filter(Boolean),
    );

    return ['Tous', ...Array.from(values).sort((a, b) => a.localeCompare(b, 'fr'))];
  });
  protected readonly filteredFavorites = computed(() => {
    const category = this.selectedCategory();
    const favorites = this.favorites().filter((favorite) => {
      const matchesCategory =
        category === 'Tous' ||
        (favorite.service?.categoryName || favorite.subtitle) === category;
      const matchesAvailability =
        !this.availableOnly() || favorite.isOnline || favorite.isAvailableToday;

      return matchesCategory && matchesAvailability;
    });

    return [...favorites].sort((left, right) => {
      if (this.sortBy() === 'rating') {
        return right.rating - left.rating || right.totalReviews - left.totalReviews;
      }

      if (this.sortBy() === 'name') {
        return left.name.localeCompare(right.name, 'fr');
      }

      return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
    });
  });

  constructor() {
    if (!this.authSession.hasAuthenticatedSession()) {
      return;
    }

    this.isLoading.set(true);
    this.favoritesService.list().subscribe({
      next: () => {
        this.isLoading.set(false);
        this.errorMessage.set(null);
      },
      error: () => {
        this.isLoading.set(false);
        this.errorMessage.set('Impossible de charger vos favoris pour le moment.');
      },
    });
  }

  protected removeFavorite(professionalId: string): void {
    if (!this.authSession.hasAuthenticatedSession()) {
      return;
    }

    this.favoritesService.remove(professionalId).subscribe({
      next: () => this.feedback.success('Favori retire de votre liste.'),
      error: () => {
        this.feedback.error('Impossible de retirer ce favori pour le moment.');
      },
    });
  }

  protected selectCategory(category: string): void {
    this.selectedCategory.set(category);
  }

  protected toggleAvailableFilter(): void {
    this.availableOnly.update((value) => !value);
  }

  protected shareList(): void {
    const url = window.location.href;
    const text = `Mes favoris Jokko Dimbali: ${this.favorites()
      .map((favorite) => favorite.name)
      .join(', ')}`;

    if (navigator.share) {
      void navigator.share({
        title: 'Mes favoris Jokko Dimbali',
        text,
        url,
      });
      return;
    }

    void navigator.clipboard?.writeText(`${text}\n${url}`);
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

  protected ratingLabel(favorite: FavoriteItem): string {
    if (favorite.totalReviews <= 0) return 'Aucun avis';
    return `${favorite.rating} (${favorite.totalReviews} avis)`;
  }

  protected statusLabel(favorite: FavoriteItem): string {
    if (favorite.isOnline) {
      return favorite.lastSeenAt
        ? `En ligne - ${this.relativeTime(favorite.lastSeenAt)}`
        : 'En ligne maintenant';
    }

    if (favorite.isAvailableToday) return "Disponible aujourd'hui";
    return 'Disponible prochainement';
  }

  protected gallery(favorite: FavoriteItem) {
    return favorite.portfolioImages.slice(0, 2);
  }

  protected initials(name: string): string {
    return name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('');
  }

  private relativeTime(value: string): string {
    const diffMinutes = Math.max(
      0,
      Math.round((Date.now() - new Date(value).getTime()) / 60_000),
    );

    if (diffMinutes < 1) return 'maintenant';
    if (diffMinutes < 60) return `il y a ${diffMinutes} min`;

    const hours = Math.round(diffMinutes / 60);
    if (hours < 24) return `il y a ${hours} h`;

    return 'maintenant';
  }
}
